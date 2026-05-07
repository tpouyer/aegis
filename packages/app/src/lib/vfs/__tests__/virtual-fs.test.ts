import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VirtualFileSystem } from '../virtual-fs';
import type { GitHubClient } from '@/lib/github/client';

// Mock the blob cache so it doesn't touch IndexedDB
vi.mock('../cache', () => ({
  getCachedBlob: vi.fn().mockResolvedValue(null),
  setCachedBlob: vi.fn().mockResolvedValue(undefined),
  hasCachedBlob: vi.fn().mockResolvedValue(false),
}));

// Mock atomicCommit
vi.mock('@/lib/github/git-ops', () => ({
  atomicCommit: vi.fn().mockResolvedValue('new-commit-sha'),
}));

function createMockGithub(): GitHubClient {
  return {
    getRepo: vi.fn().mockResolvedValue({
      owner: 'test-org',
      repo: 'test-repo',
      defaultBranch: 'main',
    }),
    getRef: vi.fn().mockResolvedValue({
      ref: 'refs/heads/feature/TEST-1-impl',
      sha: 'abc123',
    }),
    getTree: vi.fn().mockResolvedValue([
      { path: 'src', mode: '040000', type: 'tree', sha: 'tree-sha-1' },
      { path: 'src/index.ts', mode: '100644', type: 'blob', sha: 'blob-sha-1', size: 100 },
      { path: 'src/utils.ts', mode: '100644', type: 'blob', sha: 'blob-sha-2', size: 200 },
      { path: 'README.md', mode: '100644', type: 'blob', sha: 'blob-sha-3', size: 50 },
    ]),
    getBlob: vi.fn().mockResolvedValue('file content here'),
    getFileContent: vi.fn(),
    createBranch: vi.fn(),
    branchExists: vi.fn(),
    createBlob: vi.fn(),
    createTree: vi.fn(),
    createCommit: vi.fn(),
    updateRef: vi.fn(),
    createPullRequest: vi.fn(),
  } as unknown as GitHubClient;
}

describe('VirtualFileSystem', () => {
  let vfs: VirtualFileSystem;
  let mockGithub: GitHubClient;
  const repoKey = 'test-org/test-repo';

  beforeEach(async () => {
    mockGithub = createMockGithub();
    vfs = new VirtualFileSystem(mockGithub);
    await vfs.initRepo('test-org', 'test-repo', 'feature/TEST-1-impl');
  });

  describe('writeFile', () => {
    it('creates an "added" change for a new file', () => {
      vfs.writeFile(repoKey, 'src/new-file.ts', 'new content');

      const changes = vfs.getChanges(repoKey);
      expect(changes).toHaveLength(1);
      expect(changes[0].path).toBe('src/new-file.ts');
      expect(changes[0].status).toBe('added');
      expect(changes[0].currentContent).toBe('new content');
    });

    it('creates a "modified" change for an existing file', async () => {
      // Read the file first to populate openFiles
      await vfs.readFile(repoKey, 'src/index.ts');

      // Now modify it
      vfs.writeFile(repoKey, 'src/index.ts', 'modified content');

      const changes = vfs.getChanges(repoKey);
      expect(changes).toHaveLength(1);
      expect(changes[0].path).toBe('src/index.ts');
      expect(changes[0].status).toBe('modified');
      expect(changes[0].currentContent).toBe('modified content');
    });
  });

  describe('deleteFile', () => {
    it('creates a "deleted" change', async () => {
      // Read the file first
      await vfs.readFile(repoKey, 'src/index.ts');

      vfs.deleteFile(repoKey, 'src/index.ts');

      const changes = vfs.getChanges(repoKey);
      expect(changes).toHaveLength(1);
      expect(changes[0].path).toBe('src/index.ts');
      expect(changes[0].status).toBe('deleted');
      expect(changes[0].currentContent).toBeUndefined();
    });
  });

  describe('getChanges', () => {
    it('returns all changes across the repo', async () => {
      vfs.writeFile(repoKey, 'src/new-file.ts', 'new');
      await vfs.readFile(repoKey, 'src/index.ts');
      vfs.writeFile(repoKey, 'src/index.ts', 'modified');
      vfs.deleteFile(repoKey, 'README.md');

      const changes = vfs.getChanges(repoKey);
      expect(changes).toHaveLength(3);

      const statuses = changes.map((c) => c.status).sort();
      expect(statuses).toEqual(['added', 'deleted', 'modified']);
    });
  });

  describe('revertFile', () => {
    it('removes the change and restores original content', async () => {
      // Read the file first
      await vfs.readFile(repoKey, 'src/index.ts');

      // Modify it
      vfs.writeFile(repoKey, 'src/index.ts', 'modified');
      expect(vfs.hasChanges(repoKey)).toBe(true);

      // Revert
      vfs.revertFile(repoKey, 'src/index.ts');

      expect(vfs.hasChanges(repoKey)).toBe(false);
      const changes = vfs.getChanges(repoKey);
      expect(changes).toHaveLength(0);
    });
  });

  describe('hasChanges', () => {
    it('returns false when no changes exist', () => {
      expect(vfs.hasChanges(repoKey)).toBe(false);
    });

    it('returns true when changes exist', () => {
      vfs.writeFile(repoKey, 'src/new.ts', 'content');
      expect(vfs.hasChanges(repoKey)).toBe(true);
    });
  });

  describe('getDirectory', () => {
    it('returns root-level entries', () => {
      const entries = vfs.getDirectory(repoKey, '');
      const paths = entries.map((e) => e.path);
      expect(paths).toContain('src');
      expect(paths).toContain('README.md');
      // Nested files should NOT appear at root
      expect(paths).not.toContain('src/index.ts');
    });
  });

  describe('getDiff', () => {
    it('returns diff hunks for a modified file', async () => {
      await vfs.readFile(repoKey, 'src/index.ts');
      vfs.writeFile(repoKey, 'src/index.ts', 'new content');

      const diff = vfs.getDiff(repoKey, 'src/index.ts');
      expect(diff.path).toBe('src/index.ts');
      expect(diff.hunks.length).toBeGreaterThan(0);
    });

    it('returns empty hunks for an unchanged file', () => {
      const diff = vfs.getDiff(repoKey, 'src/index.ts');
      expect(diff.hunks).toHaveLength(0);
    });
  });
});
