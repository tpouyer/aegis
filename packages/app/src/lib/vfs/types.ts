/**
 * Virtual Filesystem type definitions.
 *
 * These types model the in-browser VFS that tracks file changes,
 * diffs, and per-repo state for the IDE.
 */

import type { TreeEntry } from '@/lib/github/types';

export type FileStatus = 'added' | 'modified' | 'deleted' | 'unchanged';

export interface FileChange {
  path: string;
  status: FileStatus;
  originalContent?: string;
  currentContent?: string;
  repo: string;
}

export interface DiffResult {
  path: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface VFSRepoState {
  owner: string;
  repo: string;
  branch: string;
  baseBranch: string;
  treeSha: string;
  headCommitSha: string;
  tree: TreeEntry[];
  openFiles: Map<string, string>; // path -> content
  changes: Map<string, FileChange>; // path -> change
}
