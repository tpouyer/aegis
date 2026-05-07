# Security Audit: Data Handling & API Security

**Audit date**: 2026-05-07
**Auditor**: Security code review (automated)
**Scope**: IndexedDB, localStorage, sessionStorage, Jira/GitHub clients, VFS, resilientFetch, console logging
**Threat model reference**: `docs/security/threat-model.md`

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 3     |
| Medium   | 5     |
| Low      | 4     |
| Info     | 2     |

---

## HIGH Findings

### H1: Jira API Error Responses Echoed Verbatim in Exceptions

**Severity**: High
**Threat model ref**: T1 (XSS), T6 (Information Disclosure)
**File**: `packages/app/src/lib/jira/client.ts:72-74`
**File**: `packages/app/src/lib/github/client.ts:54-57`

**Code (Jira)**:
```typescript
const text = await response.text().catch(() => '');
throw new JiraClientError(
  `Jira API error: ${response.status} ${response.statusText} — ${text}`,
```

**Code (GitHub)**:
```typescript
const body = await response.text().catch(() => '');
throw new Error(
  `GitHub API ${response.status}: ${response.statusText} — ${path}\n${body}`,
```

**Attack scenario**: The full API error response body is captured and embedded in the thrown error message. Jira API error bodies can contain:
- Internal server paths and stack traces
- Cloud instance identifiers and hostnames
- User email addresses in permission error messages
- JQL query details that reveal project structure

The GitHub client additionally embeds the request `path` in the error, leaking the owner/repo/ref being accessed.

These error messages propagate to:
1. The `ErrorBoundary` component (`ErrorBoundary.tsx:47`), which renders `error.message` directly into the DOM
2. `console.error` in `ErrorBoundary.tsx:25`
3. The chat store if errors occur during tool execution (`tool-router.ts:129-130`)

If the error body contains HTML or script content from a malformed API response, and this message reaches `react-markdown` rendering in the chat UI, it could trigger XSS (per T1).

**Recommended fix**:
- Truncate error response bodies to a safe maximum (e.g., 500 chars)
- Strip HTML tags from error response text before embedding in error messages
- Never include the raw response body in user-facing error displays; use a generic message with a correlation ID for debugging
- Remove the `path` from the GitHub error message (it leaks the resource being accessed)

---

### H2: Jira Issue Key Path Injection — No Input Validation

**Severity**: High
**Threat model ref**: New (not in current threat model)
**File**: `packages/app/src/lib/jira/client.ts:140-143`

**Code**:
```typescript
async getIssue(issueKey: string): Promise<JiraIssue> {
  return this.request<JiraIssue>(
    this.apiUrl(`/api/3/issue/${issueKey}`),
  );
}
```

`issueKey` is interpolated directly into the URL path without validation or encoding. This pattern repeats at lines 142, 188, 210, 228, 242. A Jira issue key has a well-defined format (`PROJECT-123`), but no validation is performed.

**Attack scenario**: If `issueKey` is user-controlled (e.g., from URL parameters via TanStack Router), an attacker could supply a value like `../../../admin/config` to traverse the API path. While Jira's REST API would likely reject malformed paths, the request still reaches the server and could:
- Probe for undocumented endpoints
- Bypass rate limiting by targeting different API paths
- Cause confusing error responses that leak information

**Recommended fix**:
- Validate `issueKey` against the pattern `/^[A-Z][A-Z0-9_]+-\d+$/` before constructing the URL
- Apply `encodeURIComponent()` to all path parameters (the GitHub client does this for `path` and `ref` in `getFileContent` but is inconsistent — `owner`, `repo`, `sha`, and `ref` in other methods are not encoded)

---

### H3: GitHub Client Path Parameters Not URL-Encoded

**Severity**: High
**Threat model ref**: New (not in current threat model)
**File**: `packages/app/src/lib/github/client.ts` (multiple lines)

**Code examples**:
```typescript
// Line 73 — sha is not encoded
`/repos/${owner}/${repo}/git/trees/${sha}${qs}`

// Line 80 — ref is not encoded
`/repos/${owner}/${repo}/git/ref/${ref}`

// Line 240 — ref is not encoded
`/repos/${owner}/${repo}/git/refs/${ref}`
```

Only `getFileContent` (line 110) uses `encodeURIComponent()` for `path` and `ref`. All other methods — `getTree`, `getRef`, `getCommit`, `getBlob`, `createBranch`, `updateRef`, `createPullRequest`, `getRepo` — interpolate `owner`, `repo`, `sha`, and `ref` directly.

**Attack scenario**: If any of these parameters originate from user input (the VFS does pass user-provided `owner`, `repo`, and `branchName` values from the UI), a crafted value containing `/` or `..` could redirect the request to unintended API endpoints. `updateRef` is particularly dangerous because it writes (PATCH) — a path-injected ref could update an unintended branch reference.

**Recommended fix**:
- Apply `encodeURIComponent()` to all path parameters in every GitHub client method
- Add input validation for `owner` (alphanumeric + hyphens), `repo` (alphanumeric + hyphens/dots/underscores), and `ref`/`sha` (hex string or valid ref name)

---

## MEDIUM Findings

### M1: IndexedDB Chat Sessions Store Unencrypted Sensitive Content

**Severity**: Medium
**Threat model ref**: T6 (IndexedDB Data Exposure)
**File**: `packages/app/src/stores/chat.ts:220-238`

**Details**: Chat sessions are persisted to IndexedDB (`aegis-chat` database) with a 7-day TTL. The `persistSession` method strips the `error` field (line 225) but persists the full message content including:
- User messages that may contain credentials, API keys, or other secrets shared in conversation
- LLM responses that may contain generated code with hardcoded secrets
- Tool call arguments and results that may contain file contents from private repositories

Data is stored as plaintext JSON in IndexedDB with no encryption.

**Attack scenario**: An XSS vulnerability (T1, T11) or a malicious browser extension with `storage` permission could read all chat history from IndexedDB. The 7-day window provides ample time for a persistent attacker.

**Recommended fix**:
- Encrypt chat session content before writing to IndexedDB using the Web Crypto API (`AES-GCM`), deriving the key from the user's auth token hash
- Add a manual "Clear all chat data" button in the settings UI
- Consider a shorter TTL for sessions containing tool results (which may include source code)

---

### M2: No Proactive IndexedDB Eviction — Expired Data Persists Until Read

**Severity**: Medium
**Threat model ref**: T6 (IndexedDB Data Exposure), T10 (DoS via Memory Growth)
**File**: `packages/app/src/lib/cache/indexeddb.ts:61-87`

**Details**: The `CacheStore.get()` method checks TTL expiry (line 77) and returns `null` for expired entries, but **does not delete the expired entry**. The comment on line 78 says "schedule cleanup" but no cleanup is scheduled. The `evictExpired()` method (line 218) exists but is never called automatically.

This means:
1. Expired Jira API responses (which contain issue details, user info, etc.) remain in IndexedDB indefinitely until overwritten or manually evicted
2. Expired chat sessions remain readable via direct IndexedDB access even after their TTL has passed
3. The VFS blob cache (`aegis-vfs-blobs`) with its 30-day TTL accumulates source code from private repositories indefinitely

**Attack scenario**: An attacker exploiting XSS could read "expired" but not-yet-evicted data from IndexedDB, including old Jira issue data, chat sessions, and source code that the user may believe has been cleared.

**Recommended fix**:
- Schedule periodic eviction (e.g., on app startup and every 15 minutes via `setInterval`)
- Delete expired entries eagerly in `get()` when they are encountered
- Add a size quota check: if IndexedDB usage exceeds a threshold (e.g., 50MB), trigger eviction

---

### M3: VFS Source Code Cached With 30-Day TTL, No Size Limit

**Severity**: Medium
**Threat model ref**: T6 (IndexedDB Data Exposure)
**File**: `packages/app/src/lib/vfs/cache.ts:15-17`

**Code**:
```typescript
const BLOB_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const blobCache = new CacheStore('aegis-vfs-blobs', 'blobs');
```

**Details**: File contents from private GitHub repositories are cached for 30 days in a separate IndexedDB database (`aegis-vfs-blobs`). There is no maximum cache size, no file type filtering, and no encryption. Content-addressed caching by SHA means data is never "stale," but that also means it is never evicted by the TTL mechanism in practice (the same SHA will keep being refreshed).

**Attack scenario**: Over time, a developer's IndexedDB accumulates a readable copy of large portions of private repositories. If the device is shared, compromised, or if an XSS attack occurs, this source code cache is trivially accessible.

**Recommended fix**:
- Reduce TTL to 7 days to match chat session TTL
- Add a maximum cache size (e.g., 100MB) with LRU eviction
- Add `clearBlobCache()` to the logout flow so source code does not persist after sign-out
- Consider encrypting cached blobs

---

### M4: VFS Does Not Validate Repository Access Permissions

**Severity**: Medium
**Threat model ref**: New (not in current threat model — authorization boundary)
**File**: `packages/app/src/lib/vfs/virtual-fs.ts:310-343`

**Details**: The `commit()` method performs atomic commits via the Git Data API without any client-side validation of whether the user should have write access to the target repository. The VFS accepts any `owner/repo` string at `initRepo()` (line 37) and the `commit()` method will attempt to push to whatever branch is initialized.

The `ensureBranch()` method (line 369) will create branches on any repository the GitHub token has access to, not just the repository associated with the current issue.

**Attack scenario**: If the GitHub OAuth token has `repo` scope (it does — line 41 of `github.ts`), and the UI has a bug or is manipulated via the browser console, a user could:
1. Initialize the VFS with an arbitrary `owner/repo` (e.g., the organization's infrastructure repo)
2. Create a branch on that repo
3. Commit changes to that branch
4. Create a PR against the main branch

The GitHub API enforces server-side permissions, but the `repo` scope grants broad access. The client should restrict operations to repositories associated with the current issue context.

**Recommended fix**:
- Maintain a whitelist of repositories the user is expected to interact with (derived from the issue's component-to-repo mapping in `config/components.yml`)
- Validate that `owner/repo` matches the allowed list before `initRepo()`, `commit()`, and `createPR()`
- Consider requesting narrower GitHub OAuth scopes

---

### M5: Tool Router Logs Tool Arguments Including Potentially Sensitive Data

**Severity**: Medium
**Threat model ref**: T6 (Information Disclosure)
**File**: `packages/app/src/lib/llm/tool-router.ts:28-43`

**Code**:
```typescript
function logToolCall(toolCall: ToolCall): void {
  if (!DEBUG) return;
  console.debug(
    `[tool-router] call: ${toolCall.name} (${toolCall.id})`,
    toolCall.arguments,   // <-- full arguments object logged
  );
}

function logToolResult(result: ToolResult): void {
  if (!DEBUG) return;
  const status = result.isError ? 'ERROR' : 'OK';
  console.debug(
    `[tool-router] result [${status}]: ${result.toolCallId}`,
    result.content.slice(0, 200),  // <-- first 200 chars of result logged
  );
}
```

**Details**: The `DEBUG` flag is `true` whenever `NODE_ENV !== 'production'`, which includes all development and staging builds. Tool arguments can contain file paths, search queries, or code snippets. The result content (truncated to 200 chars) may contain source code or organizational data.

The `DEBUG` check at line 24-26 defaults to `true` when `process` is undefined (browser environment), meaning these logs fire in production browser builds unless `NODE_ENV` is explicitly set:
```typescript
const DEBUG = typeof process !== 'undefined'
  ? process.env.NODE_ENV !== 'production'
  : true;  // <-- defaults to true in browser
```

**Recommended fix**:
- Invert the default: `const DEBUG = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';`
- Never log tool arguments in production; log only the tool name
- Truncate result content to a shorter length or omit entirely in production

---

## LOW Findings

### L1: resilientFetch Logs Full URLs on Retry (Including Query Parameters)

**Severity**: Low
**Threat model ref**: T6 (Information Disclosure)
**File**: `packages/app/src/lib/fetch/resilient-fetch.ts:194-196, 211-213`

**Code**:
```typescript
console.debug(
  `[resilientFetch] Retry ${attempt + 1}/${config.maxRetries} for ${url} ` +
    `(status ${response.status}, waiting ${Math.round(delay)}ms)`,
);
```

**Details**: The full URL (including query parameters) is logged to `console.debug` on every retry. For Jira requests, the URL can contain JQL queries that reveal project names, issue keys, and filter criteria. For GitHub requests, it reveals repository paths.

While `console.debug` is typically filtered in production browser consoles, it is still accessible to browser extensions and can be captured by logging frameworks.

**Recommended fix**:
- Log only the URL path (strip query parameters and the domain)
- Gate behind the same production check used elsewhere

---

### L2: GET Deduplication Enables Timing Side-Channel

**Severity**: Low
**Threat model ref**: New
**File**: `packages/app/src/lib/fetch/resilient-fetch.ts:148-153`

**Code**:
```typescript
if (isGET(options)) {
  const existing = inflightGETs.get(url);
  if (existing) {
    return existing.then((r) => r.clone());
  }
}
```

**Details**: The deduplication map is keyed by the full URL string. If two code paths request the same URL, the second receives a clone of the first response. This is an optimization, but it creates a timing side-channel: a component can detect whether another component has already requested a specific resource by measuring response latency (deduplicated responses are near-instant vs. network latency).

**Attack scenario**: In a multi-tenant or shared browser context, an attacker component could probe whether the user is viewing a specific Jira issue or GitHub file by issuing GET requests and measuring response times. This is a theoretical risk given the single-user, single-origin architecture.

**Recommended fix**:
- This is an acceptable risk for the current architecture. Document it as a known limitation.
- If multi-tenant isolation is ever needed, key deduplication by requester identity, not just URL.

---

### L3: ErrorBoundary Renders Raw Error Messages to the DOM

**Severity**: Low
**Threat model ref**: T1 (XSS)
**File**: `packages/app/src/components/shared/ErrorBoundary.tsx:46-48`

**Code**:
```tsx
<p className="mt-1 text-sm text-muted-foreground">
  {this.state.error?.message || 'An unexpected error occurred'}
</p>
```

**Details**: The `error.message` is rendered as a React text node, which React escapes by default (no XSS risk from React's rendering). However, the error message content — which can include full API response bodies (see H1) — is displayed to the user. This can leak internal API details, server paths, and user information from error responses.

**Recommended fix**:
- Display a generic "Something went wrong" message to the user
- Log the full error details only to `console.error` (as is already done at line 25)
- Add a "Copy error details" button for support purposes instead of displaying the raw message

---

### L4: sessionStorage PKCE Keys Use Predictable Naming Convention

**Severity**: Low
**Threat model ref**: T12 (PKCE Verifier Exposure)
**Files**:
- `packages/app/src/lib/auth/github.ts:22-23`
- `packages/app/src/lib/auth/atlassian.ts:18-19`
- `packages/app/src/lib/auth/redhat-sso.ts:18-19`
- `packages/app/src/lib/auth/google.ts:19-20`

**Details**: All four OAuth providers use predictable sessionStorage key names:
- `aegis_github_pkce_verifier`, `aegis_github_oauth_state`
- `aegis_atlassian_pkce_verifier`, `aegis_atlassian_oauth_state`
- `aegis_rhsso_pkce_verifier`, `aegis_rhsso_oauth_state`
- `aegis_google_pkce_verifier`, `aegis_google_oauth_state`

An XSS attack during the OAuth flow window (T12) can trivially enumerate and read all active PKCE verifiers. The verifiers are cleared immediately after the callback (good), but during the redirect window (~5-30 seconds), all four sets of keys are scannable.

**Implementation note**: The cleanup pattern is correct — all four providers remove verifiers immediately after use (before any async network call to the token endpoint). This limits the exposure window. The state validation logic is also correct across all providers.

**Recommended fix**:
- Acceptable risk at current severity. The short exposure window and the requirement for the attacker to also intercept the authorization code make exploitation unlikely.
- For defense-in-depth, consider using a single randomized key name per flow instance instead of a static prefix.

---

## INFORMATIONAL Findings

### I1: localStorage Stores Only Non-Sensitive Metadata

**Severity**: Info
**Threat model ref**: N/A (positive finding)

**Details**: Audit confirms that localStorage is used exclusively for:
1. **Theme preference** (`aegis_theme`): `'dark'` or `'light'` string — `stores/theme.ts:11,28`
2. **Token metadata** (`aegis_token_metadata`): JSON array of `{provider, expiresAt, hasRefreshToken}` — `lib/auth/manager.ts:329-330`

No actual tokens, credentials, or sensitive data are stored in localStorage. The token metadata contains only the provider name, expiry timestamp, and a boolean indicating whether a refresh token exists. The `accessToken` field is intentionally set to an empty string `''` when restoring from localStorage (manager.ts:349), confirming tokens are not persisted there.

This aligns with the threat model's documentation and is a strong security property.

---

### I2: AuthManager Token Handling in Main Thread Memory

**Severity**: Info
**Threat model ref**: T4 (Token Exfiltration)

**Details**: While the threat model states tokens live "ONLY in the Service Worker's memory Map," the `AuthManager` class (`lib/auth/manager.ts:108-109`) also stores the full `TokenSet` (including `accessToken` and `refreshToken`) in the main thread's `this.state.tokens` object.

```typescript
async setToken(provider: AuthProvider, token: TokenSet): Promise<void> {
  this.state.tokens[provider] = token;  // <-- actual token in main thread memory
```

This means actual OAuth tokens are accessible from the main thread via `authManager.getState().tokens[provider].accessToken`. While they are not persisted to disk (localStorage only gets metadata), they are vulnerable to XSS exfiltration from main thread JavaScript during the session.

The `getState()` method (line 99-101) returns a shallow copy of the state, but the `tokens` object is shared by reference, meaning any caller can access the raw token values.

**Recommended fix**:
- Remove actual token storage from the `AuthManager` state; store only metadata in-memory
- Route all API calls through the Service Worker (which already injects auth headers)
- If the main thread must hold tokens temporarily (e.g., during the callback exchange), clear them from memory after syncing to the SW

---

## Cross-Cutting Observations

### Console Logging Summary

| File | Level | Content Logged | Production Risk |
|------|-------|----------------|-----------------|
| `tool-router.ts:30-33` | `debug` | Tool name, ID, full arguments object | **Medium** — arguments may contain sensitive data; DEBUG defaults to true in browser |
| `tool-router.ts:39-42` | `debug` | Tool result (200 chars) | **Medium** — may contain source code |
| `resilient-fetch.ts:194-196` | `debug` | Full URL including query params | **Low** — reveals API endpoints and query patterns |
| `resilient-fetch.ts:211-213` | `debug` | Full URL + network error message | **Low** — same as above |
| `auth/manager.ts:162` | `warn` | Provider name + error object | **None** — no sensitive data |
| `auth/manager.ts:181,239` | `warn` | Provider name + error object | **None** |
| `auth/manager.ts:289` | `error` | "Listener threw" + error | **None** |
| `auth/sw-bridge.ts:73` | `warn` | Static message | **None** |
| `ErrorBoundary.tsx:25` | `error` | Error object + component stack | **Low** — error may contain API response bodies |

### IndexedDB Database Summary

| Database | Store | Data | TTL | Encrypted |
|----------|-------|------|-----|-----------|
| `aegis-jira-cache` | `jira` | Board configs, issues, users, search results | 60s-24h | No |
| `aegis-chat` | `sessions` | Full chat history (user + LLM messages, tool calls/results) | 7 days | No |
| `aegis-vfs-blobs` | `blobs` | File contents from GitHub repos | 30 days | No |

### Input Validation Summary

| Client | Parameter | Validated | Encoded |
|--------|-----------|-----------|---------|
| Jira | `issueKey` | No | No |
| Jira | `boardId` | Typed as `number` | N/A |
| Jira | `jql` | No | Via URLSearchParams |
| GitHub | `owner` | No | No |
| GitHub | `repo` | No | No |
| GitHub | `sha` | No | No |
| GitHub | `ref` | No | Only in `getFileContent` |
| GitHub | `path` | No | Only in `getFileContent` |
| GitHub | `branchName` | No | No |

---

## Priority Recommendations

1. **P0**: Fix H2/H3 — Add input validation and URL encoding to all Jira and GitHub client path parameters. This is low effort and prevents path traversal.

2. **P1**: Fix H1 — Sanitize and truncate API error response bodies before embedding in error messages. Stop rendering raw error messages in the ErrorBoundary.

3. **P1**: Fix M5 — Invert the DEBUG default in `tool-router.ts` so production builds never log tool arguments.

4. **P2**: Fix M1/M2/M3 — Add scheduled IndexedDB eviction, encrypt chat sessions, reduce VFS cache TTL, and clear caches on logout.

5. **P2**: Fix M4 — Add repository whitelist validation to VFS write operations.

6. **P3**: Address I2 — Remove actual token values from `AuthManager`'s main-thread state to match the documented security model.
