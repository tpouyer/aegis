import { beforeEach, describe, expect, it, vi } from 'vitest';
import { atomicCommit } from '../git-ops';
import type { GitHubClient } from '../client';
import type { FileChange } from '@/lib/vfs/types';

function createMockGithub(): GitHubClient {
  return {
    createBlob: vi.fn().mockResolvedValue('blob-sha-new'),
    createTree: vi.fn().mockResolvedValue('tree-sha-new'),
    createCommit: vi.fn().mockResolvedValue('commit-sha-new'),
    updateRef: vi.fn().mockResolvedValue(undefined),
  } as unknown as GitHubClient;
}

describe('atomicCommit', () => {
  let mockGithub: GitHubClient;

  beforeEach(() => {
    mockGithub = createMockGithub();
  });

  it('calls createBlob for each added/modified file', async () => {
    const changes: FileChange[] = [
      { path: 'src/a.ts', status: 'added', currentContent: 'content-a', repo: 'org/repo' },
      { path: 'src/b.ts', status: 'modified', currentContent: 'content-b', repo: 'org/repo' },
    ];

    await atomicCommit(
      mockGithub, 'org', 'repo', 'feature/test',
      'base-sha', 'base-tree-sha', changes, 'test commit',
    );

    expect(mockGithub.createBlob).toHaveBeenCalledTimes(2);
    expect(mockGithub.createBlob).toHaveBeenCalledWith('org', 'repo', 'content-a', 'utf-8');
    expect(mockGithub.createBlob).toHaveBeenCalledWith('org', 'repo', 'content-b', 'utf-8');
  });

  it('creates tree with correct entries including deletions', async () => {
    const changes: FileChange[] = [
      { path: 'src/new.ts', status: 'added', currentContent: 'new code', repo: 'org/repo' },
      { path: 'src/old.ts', status: 'deleted', repo: 'org/repo' },
    ];

    await atomicCommit(
      mockGithub, 'org', 'repo', 'feature/test',
      'base-sha', 'base-tree-sha', changes, 'add and delete',
    );

    expect(mockGithub.createTree).toHaveBeenCalledTimes(1);
    const treeCallArgs = (mockGithub.createTree as ReturnType<typeof vi.fn>).mock.calls[0];

    // Should have base tree
    expect(treeCallArgs[2]).toBe('base-tree-sha');

    // Should have two entries
    const entries = treeCallArgs[3] as Array<{ path: string; sha: string | null }>;
    expect(entries).toHaveLength(2);

    // New file should have a blob SHA
    const newEntry = entries.find((e) => e.path === 'src/new.ts');
    expect(newEntry?.sha).toBe('blob-sha-new');

    // Deleted file should have null SHA
    const deletedEntry = entries.find((e) => e.path === 'src/old.ts');
    expect(deletedEntry?.sha).toBeNull();
  });

  it('updates ref to new commit SHA', async () => {
    const changes: FileChange[] = [
      { path: 'src/a.ts', status: 'added', currentContent: 'code', repo: 'org/repo' },
    ];

    const commitSha = await atomicCommit(
      mockGithub, 'org', 'repo', 'feature/test',
      'base-sha', 'base-tree-sha', changes, 'commit msg',
    );

    expect(commitSha).toBe('commit-sha-new');
    expect(mockGithub.updateRef).toHaveBeenCalledWith(
      'org', 'repo', 'heads/feature/test', 'commit-sha-new',
    );
  });

  it('chains operations in correct order: blobs -> tree -> commit -> ref', async () => {
    const callOrder: string[] = [];

    (mockGithub.createBlob as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push('createBlob');
      return 'blob-sha';
    });
    (mockGithub.createTree as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push('createTree');
      return 'tree-sha';
    });
    (mockGithub.createCommit as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push('createCommit');
      return 'commit-sha';
    });
    (mockGithub.updateRef as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push('updateRef');
    });

    const changes: FileChange[] = [
      { path: 'a.ts', status: 'added', currentContent: 'x', repo: 'org/repo' },
    ];

    await atomicCommit(
      mockGithub, 'org', 'repo', 'feat', 'base', 'base-tree', changes, 'msg',
    );

    expect(callOrder).toEqual(['createBlob', 'createTree', 'createCommit', 'updateRef']);
  });
});
