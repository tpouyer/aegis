import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock resilientFetch to behave like plain fetch for testing
const mockFetch = vi.hoisted(() => vi.fn())
vi.mock('../../fetch/resilient-fetch', () => ({
  resilientFetch: (...args: unknown[]) => mockFetch(...args),
}))

import { GitHubClient } from '../client'

function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }
}

describe('GitHubClient', () => {
  let client: GitHubClient

  beforeEach(() => {
    client = new GitHubClient('https://api.github.com')
    mockFetch.mockReset()
  })

  describe('getTree', () => {
    it('builds correct URL with recursive flag', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          tree: [
            { path: 'src', mode: '040000', type: 'tree', sha: 'abc' },
            { path: 'src/index.ts', mode: '100644', type: 'blob', sha: 'def' },
          ],
        }),
      )

      await client.getTree('org', 'repo', 'sha123', true)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toBe('https://api.github.com/repos/org/repo/git/trees/sha123?recursive=1')
    })

    it('builds correct URL without recursive flag', async () => {
      mockFetch.mockResolvedValue(mockResponse({ tree: [] }))

      await client.getTree('org', 'repo', 'sha123')

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toBe('https://api.github.com/repos/org/repo/git/trees/sha123')
    })
  })

  describe('createBranch', () => {
    it('sends correct POST body', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          ref: 'refs/heads/feature/TEST-1-impl',
          object: { sha: 'new-sha' },
        }),
      )

      await client.createBranch('org', 'repo', 'feature/TEST-1-impl', 'base-sha')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.github.com/repos/org/repo/git/refs')
      expect(options.method).toBe('POST')

      const body = JSON.parse(options.body as string)
      expect(body).toEqual({
        ref: 'refs/heads/feature/TEST-1-impl',
        sha: 'base-sha',
      })
    })
  })

  describe('getFileContent', () => {
    it('fetches with correct ref parameter', async () => {
      mockFetch.mockResolvedValue(
        mockResponse({
          path: 'src/index.ts',
          content: 'Y29udGVudA==',
          sha: 'blob-sha',
          encoding: 'base64',
          size: 7,
        }),
      )

      const result = await client.getFileContent('org', 'repo', 'src/index.ts', 'feature/test')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('ref=feature%2Ftest')
      expect(calledUrl).toContain('src%2Findex.ts')

      expect(result.path).toBe('src/index.ts')
      expect(result.sha).toBe('blob-sha')
      expect(result.encoding).toBe('base64')
    })
  })

  describe('createBlob', () => {
    it('sends content and returns SHA', async () => {
      mockFetch.mockResolvedValue(mockResponse({ sha: 'new-blob-sha' }))

      const sha = await client.createBlob('org', 'repo', 'file content', 'utf-8')

      expect(sha).toBe('new-blob-sha')
      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe('https://api.github.com/repos/org/repo/git/blobs')
      expect(JSON.parse(options.body as string)).toEqual({
        content: 'file content',
        encoding: 'utf-8',
      })
    })
  })

  describe('error handling', () => {
    it('throws on non-2xx response', async () => {
      mockFetch.mockResolvedValue(mockResponse({ message: 'Not Found' }, 404))

      await expect(client.getTree('org', 'repo', 'bad-sha')).rejects.toThrow('GitHub API 404')
    })
  })
})
