/**
 * Git operations helper — atomic multi-file commit via Git Data API.
 *
 * Implements the commit flow from design doc section 7.7:
 *   1. createBlob for each changed file
 *   2. createTree with all blob SHAs
 *   3. createCommit
 *   4. updateRef
 *
 * This is extracted from VirtualFileSystem so it can be tested
 * and reused independently.
 */

import type { GitHubClient } from './client';
import type { FileChange } from '@/lib/vfs/types';

/**
 * Perform an atomic multi-file commit via the Git Data API.
 *
 * @returns The SHA of the new commit.
 */
export async function atomicCommit(
  github: GitHubClient,
  owner: string,
  repo: string,
  branch: string,
  baseSha: string,
  baseTreeSha: string,
  changes: FileChange[],
  message: string,
): Promise<string> {
  // 1. Create blobs for each added or modified file
  const treeEntries: Array<{
    path: string;
    mode: string;
    type: string;
    sha: string | null;
  }> = [];

  for (const change of changes) {
    if (change.status === 'deleted') {
      // A null sha signals deletion in the tree
      treeEntries.push({
        path: change.path,
        mode: '100644',
        type: 'blob',
        sha: null,
      });
    } else if (change.currentContent !== undefined) {
      // Added or modified — create a blob
      const blobSha = await github.createBlob(
        owner,
        repo,
        change.currentContent,
        'utf-8',
      );
      treeEntries.push({
        path: change.path,
        mode: '100644',
        type: 'blob',
        sha: blobSha,
      });
    }
  }

  // 2. Create tree from base tree + new entries
  const treeSha = await github.createTree(
    owner,
    repo,
    baseTreeSha,
    treeEntries,
  );

  // 3. Create commit pointing to the new tree
  const commitSha = await github.createCommit(
    owner,
    repo,
    message,
    treeSha,
    [baseSha],
  );

  // 4. Update branch ref to point to new commit
  await github.updateRef(owner, repo, `heads/${branch}`, commitSha);

  return commitSha;
}
