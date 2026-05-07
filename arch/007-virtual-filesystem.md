# ADR-007: Virtual Filesystem

## Status: Accepted

## Context

The Aegis IDE runs entirely in the browser. Developers need to browse files, edit code, and commit changes for GitHub-hosted repositories — all without a local filesystem or git clone. The key forces are:

- **No local filesystem**: browsers have no general-purpose filesystem access. Web APIs like the File System Access API are limited and not available in all browsers.
- **No git clone**: cloning a repository requires a filesystem to write into and significant bandwidth for large repos. WASM-based git implementations (isomorphic-git) add ~500KB+ to the bundle and still need a filesystem backend.
- **GitHub API budget**: GitHub allows 5,000 authenticated requests per hour. A single recursive tree fetch returns the entire repo structure in one call. File reads are cached by blob SHA (content-addressed, never stale), so the budget is consumed primarily on first access.
- **Multi-repo support**: a single Jira issue may span multiple repositories (e.g., awx + receptor). The IDE must handle separate file trees, change tracking, and commits per repo.

## Decision

### 1. Virtual Filesystem over git clone

The IDE uses a Virtual Filesystem (VFS) backed by GitHub's REST API, mirroring the approach used by github.dev and vscode.dev. There is no git clone, no local database of objects, and no working tree. The VFS provides:

- **Tree reads**: `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` fetches the entire directory structure in a single API call.
- **File reads**: `GET /repos/{owner}/{repo}/git/blobs/{sha}` fetches individual file content on demand when a user opens a file.
- **Local writes**: file modifications are stored in memory (`Map<string, FileChange>`) until the user commits.
- **Atomic commits**: the Git Data API (blobs, trees, commits, refs) enables multi-file atomic commits without needing a local git repository.

### 2. Content-addressed caching (blob SHA as key)

File content is cached in IndexedDB keyed by the blob SHA. This is the same content-addressing strategy that git itself uses:

- The same SHA always returns exactly the same content (immutable)
- Cache entries never go stale — no TTL-based invalidation needed
- A 30-day TTL is used as a pragmatic eviction strategy to prevent unbounded storage growth
- The cache namespace (`aegis-vfs-blobs`) is separate from the Jira cache to avoid interference

This reduces GitHub API calls dramatically: once a file has been read, it is never fetched again unless the file changes (which produces a new SHA).

### 3. GitHub API call budget

| Operation | API Calls | When |
|---|---|---|
| Load file tree | 1 per repo | IDE opens |
| Read file | 1 per file (cached by SHA) | File clicked |
| Ensure branch exists | 1-2 (check + create) | IDE opens |
| Atomic commit | N+3 (N blobs + 1 tree + 1 commit + 1 ref update) | User commits |
| Create PR | 1 | User creates PR |

A typical session (open IDE, browse 20 files, commit 3 file changes) consumes roughly 30 API calls. At 5,000/hour, this allows ~160 concurrent sessions — well within budget.

### 4. Atomic commits via Git Data API

The commit flow follows GitHub's Git Data API, implementing a five-step process:

1. **Create blobs**: `POST /repos/{owner}/{repo}/git/blobs` for each changed file (content uploaded as UTF-8 or base64)
2. **Create tree**: `POST /repos/{owner}/{repo}/git/trees` with the base **tree SHA** (not commit SHA) and all new blob entries (deletions use `sha: null`)
3. **Create commit**: `POST /repos/{owner}/{repo}/git/commits` referencing the new tree and the parent commit
4. **Update ref**: `PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}` to fast-forward the branch
5. **Refresh state**: `GET /repos/{owner}/{repo}/git/commits/{sha}` to extract the new commit's `tree.sha`, then re-fetch the tree

**Important**: GitHub's ref API returns the commit SHA, not the tree SHA. The VFS must call `getCommit()` to resolve `commit.tree.sha` before using it as `base_tree` in subsequent tree creation calls. This distinction was a source of bugs during development — using a commit SHA where a tree SHA is expected causes GitHub to create a tree with no base, losing unmodified files.

This is atomic from GitHub's perspective — if any step fails, the branch ref is not updated and no partial commit is visible.

### 5. Multi-repo handling

Each repository gets its own `VFSRepoState` containing its tree, open files, and change tracking. The SourceControl panel groups changes by repo with separate commit and PR controls for each. Cross-repo atomicity is explicitly not supported — commits to awx and receptor are independent operations, documented in the UI.

## Consequences

**Positive:**
- No WASM git implementation needed — saves ~500KB of bundle size
- No filesystem polyfill (e.g., BrowserFS, Emscripten FS) needed
- Content-addressed caching is maximally efficient — files are fetched at most once per unique version
- The Git Data API provides true atomic multi-file commits
- The same VFS abstraction works for any GitHub-hosted repo without configuration

**Negative:**
- No offline editing — file reads require network access (unless previously cached)
- No `git log`, `git blame`, or other git history operations (would require additional API calls)
- Large binary files cannot be efficiently handled (base64 encoding doubles size)
- Conflict resolution is not supported — if the branch has moved since the tree was fetched, the commit may fail (user must refresh)
- The simple line-by-line diff is inferior to a proper diff algorithm (Myers, patience) — adequate for the initial implementation but will be improved with Monaco diff in Wave 3

## Alternatives Considered

- **isomorphic-git + BrowserFS**: Full git implementation in the browser. Provides `git clone`, `git log`, `git blame`, and offline support. Rejected because it adds significant bundle size (~500KB+), requires a filesystem polyfill, and cloning large repos is slow and memory-intensive in the browser. The VFS approach is lighter and sufficient for issue-scoped editing.

- **GitHub GraphQL API**: Could reduce the number of API calls by batching multiple queries. Rejected because the REST API's recursive tree endpoint already returns the full tree in one call, and the Git Data API for commits is only available via REST. GraphQL would add complexity without meaningful savings.

- **Service Worker filesystem cache**: Cache file content in the Service Worker instead of IndexedDB. Rejected because the SW can be evicted by the browser, losing the cache. IndexedDB is persistent and survives SW restarts. The SW already handles auth token injection; adding file caching would conflate responsibilities.
