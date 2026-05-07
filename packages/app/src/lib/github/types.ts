/**
 * GitHub API type definitions.
 *
 * These types model the subset of GitHub's REST API used by the
 * Virtual Filesystem (VFS) and Git operations in the IDE.
 */

export interface TreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

export interface FileContent {
  path: string;
  content: string;
  sha: string;
  encoding: 'utf-8' | 'base64';
  size: number;
}

export interface GitRef {
  ref: string;
  sha: string;
}

export interface GitCommit {
  sha: string;
  message: string;
  author: { name: string; email: string; date: string };
  tree: { sha: string };
  parents: Array<{ sha: string }>;
}

export interface PullRequest {
  number: number;
  title: string;
  body: string;
  htmlUrl: string;
  state: 'open' | 'closed' | 'merged';
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
}

export interface RepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
}
