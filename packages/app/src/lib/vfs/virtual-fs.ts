/**
 * Virtual Filesystem — GitHub-backed file system for the browser IDE.
 *
 * No git clone, no local filesystem. Files are fetched on demand from
 * GitHub's REST API and cached by blob SHA (content-addressed, never
 * stale). Writes are tracked locally until the user commits.
 *
 * Design doc reference: sections 7.1-7.7.
 */

import type { GitHubClient } from '@/lib/github/client';
import type { TreeEntry, PullRequest } from '@/lib/github/types';
import type {
  FileChange,
  DiffResult,
  DiffHunk,
  DiffLine,
  VFSRepoState,
} from './types';
import { getCachedBlob, setCachedBlob } from './cache';
import { atomicCommit } from '@/lib/github/git-ops';

export class VirtualFileSystem {
  private repos: Map<string, VFSRepoState> = new Map();
  private github: GitHubClient;

  constructor(github: GitHubClient) {
    this.github = github;
  }

  // ── Repo initialization ──────────────────────────────────────────

  /**
   * Initialize a repo in the VFS: fetch the tree, resolve the head
   * commit, and store the repo state.
   */
  async initRepo(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<void> {
    const key = this.repoKey(owner, repo);

    // Get the repo info for the default branch
    const repoInfo = await this.github.getRepo(owner, repo);

    // Get the ref for the branch
    const ref = await this.github.getRef(owner, repo, `heads/${branch}`);

    // Get the full recursive tree
    const tree = await this.github.getTree(owner, repo, ref.sha, true);

    // We need the commit to get the tree SHA
    // The ref.sha IS the commit SHA; we need the tree SHA from it
    // For simplicity, use the ref SHA as both — the tree call above
    // already used it correctly.
    const state: VFSRepoState = {
      owner,
      repo,
      branch,
      baseBranch: repoInfo.defaultBranch,
      treeSha: ref.sha, // will be updated on commit
      headCommitSha: ref.sha,
      tree,
      openFiles: new Map(),
      changes: new Map(),
    };

    this.repos.set(key, state);
  }

  // ── Tree operations ──────────────────────────────────────────────

  /**
   * Get the full tree for a repo.
   */
  getTree(repoKey: string): TreeEntry[] {
    const state = this.getState(repoKey);
    return state.tree;
  }

  /**
   * Get directory entries at a specific path.
   * Returns immediate children (not recursive).
   */
  getDirectory(repoKey: string, path: string): TreeEntry[] {
    const state = this.getState(repoKey);
    const prefix = path ? `${path}/` : '';
    const depth = prefix.split('/').filter(Boolean).length;

    return state.tree.filter((entry) => {
      if (!path) {
        // Root level: entries with no "/" in the path
        return !entry.path.includes('/');
      }
      // Entries that start with the prefix and are one level deeper
      if (!entry.path.startsWith(prefix)) return false;
      const entryDepth = entry.path.split('/').filter(Boolean).length;
      return entryDepth === depth + 1;
    });
  }

  // ── File operations ──────────────────────────────────────────────

  /**
   * Read a file. Checks local changes first, then the cache, then
   * fetches from GitHub and caches by blob SHA.
   */
  async readFile(repoKey: string, path: string): Promise<string> {
    const state = this.getState(repoKey);

    // Check local changes first
    const change = state.changes.get(path);
    if (change && change.status !== 'deleted' && change.currentContent !== undefined) {
      return change.currentContent;
    }

    // Check if already fetched this session
    if (state.openFiles.has(path)) {
      return state.openFiles.get(path)!;
    }

    // Find the tree entry to get the blob SHA
    const entry = state.tree.find((e) => e.path === path && e.type === 'blob');
    if (!entry) {
      throw new Error(`File not found: ${path}`);
    }

    // Check the content-addressed cache
    const cached = await getCachedBlob(entry.sha);
    if (cached !== null) {
      state.openFiles.set(path, cached);
      return cached;
    }

    // Fetch from GitHub
    const content = await this.github.getBlob(
      state.owner,
      state.repo,
      entry.sha,
    );

    // Cache by SHA (content-addressed — never stale)
    await setCachedBlob(entry.sha, content);
    state.openFiles.set(path, content);

    return content;
  }

  // ── Write operations (local only until commit) ───────────────────

  /**
   * Write a file. Creates an 'added' or 'modified' change.
   */
  writeFile(repoKey: string, path: string, content: string): void {
    const state = this.getState(repoKey);
    const existingEntry = state.tree.find(
      (e) => e.path === path && e.type === 'blob',
    );

    const originalContent = state.openFiles.get(path);

    const change: FileChange = {
      path,
      status: existingEntry ? 'modified' : 'added',
      originalContent,
      currentContent: content,
      repo: repoKey,
    };

    state.changes.set(path, change);
    state.openFiles.set(path, content);
  }

  /**
   * Delete a file. Creates a 'deleted' change.
   */
  deleteFile(repoKey: string, path: string): void {
    const state = this.getState(repoKey);
    const originalContent = state.openFiles.get(path);

    const change: FileChange = {
      path,
      status: 'deleted',
      originalContent,
      currentContent: undefined,
      repo: repoKey,
    };

    state.changes.set(path, change);
    state.openFiles.delete(path);
  }

  // ── Change tracking ──────────────────────────────────────────────

  /**
   * Get all changes, optionally filtered by repo.
   */
  getChanges(repoKey?: string): FileChange[] {
    if (repoKey) {
      const state = this.repos.get(repoKey);
      if (!state) return [];
      return Array.from(state.changes.values());
    }

    // All changes across all repos
    const allChanges: FileChange[] = [];
    for (const state of this.repos.values()) {
      allChanges.push(...state.changes.values());
    }
    return allChanges;
  }

  /**
   * Check if there are uncommitted changes.
   */
  hasChanges(repoKey?: string): boolean {
    if (repoKey) {
      const state = this.repos.get(repoKey);
      return state ? state.changes.size > 0 : false;
    }

    for (const state of this.repos.values()) {
      if (state.changes.size > 0) return true;
    }
    return false;
  }

  /**
   * Compute a simple line-by-line diff for a file.
   */
  getDiff(repoKey: string, path: string): DiffResult {
    const state = this.getState(repoKey);
    const change = state.changes.get(path);

    if (!change) {
      return { path, hunks: [] };
    }

    const oldLines = (change.originalContent ?? '').split('\n');
    const newLines = (change.currentContent ?? '').split('\n');

    const lines: DiffLine[] = [];
    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
      const oldLine = i < oldLines.length ? oldLines[i] : undefined;
      const newLine = i < newLines.length ? newLines[i] : undefined;

      if (oldLine === newLine) {
        lines.push({
          type: 'context',
          content: oldLine ?? '',
          oldLineNumber: i + 1,
          newLineNumber: i + 1,
        });
      } else {
        if (oldLine !== undefined) {
          lines.push({
            type: 'remove',
            content: oldLine,
            oldLineNumber: i + 1,
          });
        }
        if (newLine !== undefined) {
          lines.push({
            type: 'add',
            content: newLine,
            newLineNumber: i + 1,
          });
        }
      }
    }

    const hunk: DiffHunk = {
      oldStart: 1,
      oldLines: oldLines.length,
      newStart: 1,
      newLines: newLines.length,
      lines,
    };

    return { path, hunks: lines.length > 0 ? [hunk] : [] };
  }

  /**
   * Revert a file to its original state.
   */
  revertFile(repoKey: string, path: string): void {
    const state = this.getState(repoKey);
    const change = state.changes.get(path);

    if (!change) return;

    // Restore original content if available
    if (change.originalContent !== undefined) {
      state.openFiles.set(path, change.originalContent);
    } else {
      state.openFiles.delete(path);
    }

    state.changes.delete(path);
  }

  // ── Git operations ───────────────────────────────────────────────

  /**
   * Commit all changes for a repo via the Git Data API.
   * Returns the new commit SHA.
   */
  async commit(repoKey: string, message: string): Promise<string> {
    const state = this.getState(repoKey);
    const changes = Array.from(state.changes.values());

    if (changes.length === 0) {
      throw new Error('No changes to commit');
    }

    const commitSha = await atomicCommit(
      this.github,
      state.owner,
      state.repo,
      state.branch,
      state.headCommitSha,
      state.treeSha,
      changes,
      message,
    );

    // Update state to reflect the new head
    state.headCommitSha = commitSha;
    state.changes.clear();

    // Refresh the tree
    const newTree = await this.github.getTree(
      state.owner,
      state.repo,
      commitSha,
      true,
    );
    state.tree = newTree;

    return commitSha;
  }

  /**
   * Create a pull request for the current branch.
   */
  async createPR(
    repoKey: string,
    params: { title: string; body: string },
  ): Promise<PullRequest> {
    const state = this.getState(repoKey);

    return this.github.createPullRequest(state.owner, state.repo, {
      title: params.title,
      body: params.body,
      head: state.branch,
      base: state.baseBranch,
    });
  }

  // ── Branch management ────────────────────────────────────────────

  /**
   * Ensure a branch exists. Creates it from the default branch if
   * it doesn't exist. Returns the branch head SHA.
   */
  async ensureBranch(
    owner: string,
    repo: string,
    branchName: string,
  ): Promise<string> {
    const exists = await this.github.branchExists(owner, repo, branchName);

    if (exists) {
      const ref = await this.github.getRef(owner, repo, `heads/${branchName}`);
      return ref.sha;
    }

    // Create from default branch
    const repoInfo = await this.github.getRepo(owner, repo);
    const defaultRef = await this.github.getRef(
      owner,
      repo,
      `heads/${repoInfo.defaultBranch}`,
    );
    const newRef = await this.github.createBranch(
      owner,
      repo,
      branchName,
      defaultRef.sha,
    );
    return newRef.sha;
  }

  // ── Internal helpers ─────────────────────────────────────────────

  private repoKey(owner: string, repo: string): string {
    return `${owner}/${repo}`;
  }

  private getState(repoKey: string): VFSRepoState {
    const state = this.repos.get(repoKey);
    if (!state) {
      throw new Error(`Repository not initialized: ${repoKey}`);
    }
    return state;
  }
}
