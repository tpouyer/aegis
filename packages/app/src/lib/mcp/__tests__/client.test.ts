import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MCPServerConfig } from '@/stores/mcp-config'
import { callTool, connect, disconnect } from '../client'

const SERVER_URL = 'https://mcp.example.com/mcp'

function makeConfig(overrides?: Partial<MCPServerConfig>): MCPServerConfig {
  return {
    id: 'test-server',
    name: 'Test Server',
    url: SERVER_URL,
    authType: 'none',
    enabled: true,
    isDefault: false,
    ...overrides,
  }
}

describe('MCP client', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe('connect', () => {
    it('connects successfully and discovers tools', async () => {
      let callCount = 0
      globalThis.fetch = vi.fn(async () => {
        callCount++
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              result: {
                protocolVersion: '2025-03-26',
                capabilities: {},
                serverInfo: { name: 'TestMCP', version: '1.0.0' },
              },
            }),
            { status: 200, headers: { 'Mcp-Session-Id': 'sess-123' } },
          )
        }
        if (callCount === 2) {
          return new Response(null, { status: 202 })
        }
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            result: {
              tools: [
                { name: 'search_issues', description: 'Search Jira issues', inputSchema: { type: 'object' } },
                { name: 'get_standards', description: 'Get coding standards', inputSchema: { type: 'object' } },
              ],
            },
          }),
          { status: 200 },
        )
      })

      const conn = await connect(makeConfig())

      expect(conn.status).toBe('connected')
      expect(conn.sessionId).toBe('sess-123')
      expect(conn.tools).toHaveLength(2)
      expect(conn.tools[0].name).toBe('search_issues')
      expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    })

    it('returns error status on network failure', async () => {
      globalThis.fetch = vi.fn(async () => {
        throw new Error('Network error')
      })

      const conn = await connect(makeConfig())

      expect(conn.status).toBe('error')
      expect(conn.error).toContain('Network error')
    })

    it('returns error status on server error', async () => {
      globalThis.fetch = vi.fn(async () => new Response('Internal Server Error', { status: 500 }))

      const conn = await connect(makeConfig())

      expect(conn.status).toBe('error')
      expect(conn.error).toContain('500')
    })

    it('returns error on JSON-RPC error response', async () => {
      globalThis.fetch = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              error: { code: -32600, message: 'Invalid request' },
            }),
            { status: 200 },
          ),
      )

      const conn = await connect(makeConfig())

      expect(conn.status).toBe('error')
      expect(conn.error).toContain('Invalid request')
    })

    it('sends bearer auth header when configured', async () => {
      const capturedHeaders: Headers[] = []
      globalThis.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        capturedHeaders.push(new Headers(init?.headers))
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: {
              protocolVersion: '2025-03-26',
              capabilities: {},
              serverInfo: { name: 'TestMCP', version: '1.0.0' },
            },
          }),
          { status: 200 },
        )
      })

      await connect(makeConfig({ authType: 'bearer', authToken: 'my-token' }))

      expect(capturedHeaders[0].get('Authorization')).toBe('Bearer my-token')
    })

    it('sends api-key header when configured', async () => {
      const calls: RequestInit[] = []
      globalThis.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init) calls.push(init)
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: {
              protocolVersion: '2025-03-26',
              capabilities: {},
              serverInfo: { name: 'TestMCP', version: '1.0.0' },
            },
          }),
          { status: 200 },
        )
      })

      await connect(makeConfig({ authType: 'api-key', authToken: 'key-abc' }))

      const headers = new Headers(calls[0]?.headers)
      expect(headers.get('x-api-key')).toBe('key-abc')
    })
  })

  describe('callTool', () => {
    it('calls a tool and returns the result', async () => {
      globalThis.fetch = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              result: {
                content: [{ type: 'text', text: 'Found 5 issues matching query' }],
              },
            }),
            { status: 200 },
          ),
      )

      const config = makeConfig()
      const conn = {
        serverId: 'test-server',
        serverName: 'Test Server',
        sessionId: 'sess-123',
        tools: [{ name: 'search', inputSchema: {} }],
        status: 'connected' as const,
      }

      const result = await callTool(config, conn, 'search', { query: 'bug' })

      expect(result.content).toHaveLength(1)
      expect(result.content[0].text).toBe('Found 5 issues matching query')
    })

    it('throws on non-connected status', async () => {
      const config = makeConfig()
      const conn = {
        serverId: 'test-server',
        serverName: 'Test Server',
        sessionId: null,
        tools: [],
        status: 'disconnected' as const,
      }

      await expect(callTool(config, conn, 'search', {})).rejects.toThrow('status is disconnected')
    })
  })

  describe('disconnect', () => {
    it('sends DELETE request with session ID', async () => {
      const fetchCalls: { method: string; url: string }[] = []
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        fetchCalls.push({ method: init?.method ?? 'GET', url })
        return new Response(null, { status: 200 })
      })

      const config = makeConfig()
      const conn = {
        serverId: 'test-server',
        serverName: 'Test Server',
        sessionId: 'sess-123',
        tools: [],
        status: 'connected' as const,
      }

      await disconnect(config, conn)

      expect(fetchCalls).toHaveLength(1)
      expect(fetchCalls[0].method).toBe('DELETE')
    })

    it('skips DELETE when no session ID', async () => {
      globalThis.fetch = vi.fn()

      const config = makeConfig()
      const conn = {
        serverId: 'test-server',
        serverName: 'Test Server',
        sessionId: null,
        tools: [],
        status: 'connected' as const,
      }

      await disconnect(config, conn)

      expect(globalThis.fetch).not.toHaveBeenCalled()
    })
  })
})
