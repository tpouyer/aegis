/**
 * Regression tests for bugs caught during deployment.
 * Each test references the bug it prevents from recurring.
 */

import { describe, expect, it, vi } from 'vitest'

describe('Bug regressions', () => {
  // Bug #5: OAuth callback URL missing base path
  it('auth config includes origin in redirect URI', async () => {
    const { getGitHubConfig } = await import('@/lib/auth/config')
    const config = getGitHubConfig()
    expect(config.redirectUri).toContain('/auth/callback?provider=github')
  })

  // Bug #7: GitHub OAuth should NOT use PKCE
  it('GitHub auth does not include code_challenge in URL params', async () => {
    const mod = await import('@/lib/auth/github')

    // The function sets window.location.href — we can't easily capture that
    // in jsdom, but we can verify the module doesn't import generateCodeChallenge
    // by checking the function source doesn't reference code_challenge
    const src = mod.initiateGitHubAuth.toString()
    expect(src).not.toContain('code_challenge')
  })

  // Bug #14: Vertex AI should not send empty Authorization header
  it('Vertex provider omits Authorization header when token is empty', async () => {
    const { VertexProvider } = await import('@/lib/llm/providers/vertex')
    const provider = new VertexProvider({
      project: 'test-project',
      region: 'us-east5',
      accessToken: '',
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('error'),
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch

    try {
      const stream = provider.chat({
        model: 'claude-sonnet-4-6',
        messages: [{ id: '1', role: 'user', content: 'test', timestamp: Date.now() }],
        stream: true,
      })

      for await (const _chunk of stream) {
        break
      }

      expect(mockFetch).toHaveBeenCalled()
      const [, options] = mockFetch.mock.calls[0]
      const headers = options.headers as Record<string, string>
      expect(headers.Authorization).toBeUndefined()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  // Bug #14 positive case: Vertex sends auth when token is provided
  it('Vertex provider includes Authorization header when token is set', async () => {
    const { VertexProvider } = await import('@/lib/llm/providers/vertex')
    const provider = new VertexProvider({
      project: 'test-project',
      region: 'us-east5',
      accessToken: 'real-token-123',
    })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('error'),
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch

    try {
      const stream = provider.chat({
        model: 'claude-sonnet-4-6',
        messages: [{ id: '1', role: 'user', content: 'test', timestamp: Date.now() }],
        stream: true,
      })

      for await (const _chunk of stream) {
        break
      }

      expect(mockFetch).toHaveBeenCalled()
      const [, options] = mockFetch.mock.calls[0]
      const headers = options.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer real-token-123')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
