/**
 * GitHub REST API client.
 *
 * Uses fetch directly — the Service Worker intercepts requests to
 * api.github.com and injects the GitHub OAuth token automatically
 * (see ADR-004). No token handling is needed here.
 *
 * Covers the subset of the API used by the VFS:
 *   - Tree/ref reads (file explorer)
 *   - File content reads (editor)
 *   - Branch management (IDE open)
 *   - Git Data API for atomic commits (blobs, trees, commits, refs)
 *   - Pull request creation
 */

import type {
  TreeEntry,
  FileContent,
  GitCommit,
  GitRef,
  PullRequest,
  RepoInfo,
} from './types';

export class GitHubClient {
  constructor(private baseUrl: string = 'https://api.github.com') {}

  // ── Helpers ──────────────────────────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `GitHub API ${response.status}: ${response.statusText} — ${path}\n${body}`,
      );
    }

    return response.json() as Promise<T>;
  }

  // ── Tree operations ──────────────────────────────────────────────

  async getTree(
    owner: string,
    repo: string,
    sha: string,
    recursive?: boolean,
  ): Promise<TreeEntry[]> {
    const qs = recursive ? '?recursive=1' : '';
    const data = await this.request<{ tree: TreeEntry[] }>(
      `/repos/${owner}/${repo}/git/trees/${sha}${qs}`,
    );
    return data.tree;
  }

  async getRef(owner: string, repo: string, ref: string): Promise<GitRef> {
    const data = await this.request<{ ref: string; object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/${ref}`,
    );
    return { ref: data.ref, sha: data.object.sha };
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<GitCommit> {
    const data = await this.request<{
      sha: string;
      message: string;
      author: { name: string; email: string; date: string };
      tree: { sha: string };
      parents: Array<{ sha: string }>;
    }>(`/repos/${owner}/${repo}/git/commits/${sha}`);
    return data;
  }

  // ── File operations ──────────────────────────────────────────────

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref: string,
  ): Promise<FileContent> {
    const data = await this.request<{
      path: string;
      content: string;
      sha: string;
      encoding: string;
      size: number;
    }>(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`);

    return {
      path: data.path,
      content: data.content,
      sha: data.sha,
      encoding: data.encoding as 'utf-8' | 'base64',
      size: data.size,
    };
  }

  async getBlob(owner: string, repo: string, sha: string): Promise<string> {
    const data = await this.request<{ content: string; encoding: string }>(
      `/repos/${owner}/${repo}/git/blobs/${sha}`,
    );

    if (data.encoding === 'base64') {
      return atob(data.content);
    }
    return data.content;
  }

  // ── Branch operations ────────────────────────────────────────────

  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    fromSha: string,
  ): Promise<GitRef> {
    const data = await this.request<{ ref: string; object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: fromSha,
        }),
      },
    );
    return { ref: data.ref, sha: data.object.sha };
  }

  async branchExists(
    owner: string,
    repo: string,
    branchName: string,
  ): Promise<boolean> {
    try {
      await this.getRef(owner, repo, `heads/${branchName}`);
      return true;
    } catch {
      return false;
    }
  }

  // ── Git Data API (atomic commits) ────────────────────────────────

  /**
   * Create a blob in the repo. Returns the blob SHA.
   */
  async createBlob(
    owner: string,
    repo: string,
    content: string,
    encoding: string = 'utf-8',
  ): Promise<string> {
    const data = await this.request<{ sha: string }>(
      `/repos/${owner}/${repo}/git/blobs`,
      {
        method: 'POST',
        body: JSON.stringify({ content, encoding }),
      },
    );
    return data.sha;
  }

  /**
   * Create a tree. Returns the tree SHA.
   */
  async createTree(
    owner: string,
    repo: string,
    baseTree: string,
    entries: Array<{
      path: string;
      mode: string;
      type: string;
      sha: string | null;
    }>,
  ): Promise<string> {
    const data = await this.request<{ sha: string }>(
      `/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify({ base_tree: baseTree, tree: entries }),
      },
    );
    return data.sha;
  }

  /**
   * Create a commit. Returns the commit SHA.
   */
  async createCommit(
    owner: string,
    repo: string,
    message: string,
    tree: string,
    parents: string[],
  ): Promise<string> {
    const data = await this.request<{ sha: string }>(
      `/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        body: JSON.stringify({ message, tree, parents }),
      },
    );
    return data.sha;
  }

  /**
   * Update a ref to point to a new SHA.
   */
  async updateRef(
    owner: string,
    repo: string,
    ref: string,
    sha: string,
  ): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/git/refs/${ref}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha }),
    });
  }

  // ── PR operations ────────────────────────────────────────────────

  async createPullRequest(
    owner: string,
    repo: string,
    params: { title: string; body: string; head: string; base: string },
  ): Promise<PullRequest> {
    const data = await this.request<{
      number: number;
      title: string;
      body: string;
      html_url: string;
      state: string;
      head: { ref: string; sha: string };
      base: { ref: string; sha: string };
    }>(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify(params),
    });

    return {
      number: data.number,
      title: data.title,
      body: data.body,
      htmlUrl: data.html_url,
      state: data.state as 'open' | 'closed' | 'merged',
      head: data.head,
      base: data.base,
    };
  }

  // ── Repo info ────────────────────────────────────────────────────

  async getRepo(owner: string, repo: string): Promise<RepoInfo> {
    const data = await this.request<{ default_branch: string }>(
      `/repos/${owner}/${repo}`,
    );
    return {
      owner,
      repo,
      defaultBranch: data.default_branch,
    };
  }
}

/**
 * Singleton GitHub client instance.
 * The Service Worker injects auth headers on outbound requests.
 */
export const githubClient = new GitHubClient();
