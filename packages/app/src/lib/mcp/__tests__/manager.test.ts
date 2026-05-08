import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMCPConfigStore } from '@/stores/mcp-config'
import * as mcpClient from '../client'
import { mcpManager } from '../manager'
import type { MCPConnection } from '../types'

vi.mock('../client', () => ({
  connect: vi.fn(),
  callTool: vi.fn(),
  disconnect: vi.fn(),
}))

function makeConnection(overrides?: Partial<MCPConnection>): MCPConnection {
  return {
    serverId: 'test-server',
    serverName: 'Test Server',
    sessionId: 'sess-1',
    tools: [
      { name: 'search', description: 'Search issues', inputSchema: { type: 'object' } },
      { name: 'read_file', description: 'Read a file', inputSchema: { type: 'object' } },
    ],
    status: 'connected',
    ...overrides,
  }
}

describe('MCPConnectionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMCPConfigStore.setState({ servers: [] })
    // Reset internal state by disconnecting all
    mcpManager.disconnectAll().catch(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('connect', () => {
    it('connects to a server from the config store', async () => {
      useMCPConfigStore.getState().addServer({
        id: 'test',
        name: 'Test',
        url: 'https://mcp.test/mcp',
        authType: 'none',
        enabled: true,
        isDefault: false,
      })

      const conn = makeConnection({ serverId: 'test', serverName: 'Test' })
      vi.mocked(mcpClient.connect).mockResolvedValue(conn)

      const result = await mcpManager.connect('test')

      expect(result).toBeDefined()
      expect(result?.status).toBe('connected')
      expect(mcpClient.connect).toHaveBeenCalledTimes(1)
    })

    it('returns undefined for unknown server ID', async () => {
      const result = await mcpManager.connect('unknown')
      expect(result).toBeUndefined()
    })
  })

  describe('getAvailableTools', () => {
    it('returns tools from connected servers', async () => {
      useMCPConfigStore.getState().addServer({
        id: 's1',
        name: 'Server 1',
        url: 'https://s1.test/mcp',
        authType: 'none',
        enabled: true,
        isDefault: false,
      })

      vi.mocked(mcpClient.connect).mockResolvedValue(
        makeConnection({
          serverId: 's1',
          serverName: 'Server 1',
          tools: [{ name: 'tool_a', description: 'Tool A', inputSchema: { type: 'object' } }],
        }),
      )

      await mcpManager.connect('s1')
      const tools = mcpManager.getAvailableTools()

      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe('tool_a')
      expect(tools[0].serverId).toBe('s1')
      expect(tools[0].serverName).toBe('Server 1')
    })

    it('skips tools from non-connected servers', async () => {
      useMCPConfigStore.getState().addServer({
        id: 's2',
        name: 'Server 2',
        url: 'https://s2.test/mcp',
        authType: 'none',
        enabled: true,
        isDefault: false,
      })

      vi.mocked(mcpClient.connect).mockResolvedValue(
        makeConnection({
          serverId: 's2',
          status: 'error',
          error: 'fail',
          tools: [{ name: 'broken', inputSchema: {} }],
        }),
      )

      await mcpManager.connect('s2')
      const tools = mcpManager.getAvailableTools()

      expect(tools).toHaveLength(0)
    })
  })

  describe('findServerForTool', () => {
    it('finds the server that provides a tool', async () => {
      useMCPConfigStore.getState().addServer({
        id: 'finder',
        name: 'Finder',
        url: 'https://finder.test/mcp',
        authType: 'none',
        enabled: true,
        isDefault: false,
      })

      vi.mocked(mcpClient.connect).mockResolvedValue(
        makeConnection({ serverId: 'finder', tools: [{ name: 'unique_tool', inputSchema: {} }] }),
      )

      await mcpManager.connect('finder')
      const conn = mcpManager.findServerForTool('unique_tool')

      expect(conn).toBeDefined()
      expect(conn?.serverId).toBe('finder')
    })

    it('returns undefined for unknown tool', () => {
      const conn = mcpManager.findServerForTool('nonexistent')
      expect(conn).toBeUndefined()
    })
  })

  describe('callTool', () => {
    it('routes to the correct server and returns result', async () => {
      useMCPConfigStore.getState().addServer({
        id: 'caller',
        name: 'Caller',
        url: 'https://caller.test/mcp',
        authType: 'none',
        enabled: true,
        isDefault: false,
      })

      vi.mocked(mcpClient.connect).mockResolvedValue(
        makeConnection({ serverId: 'caller', tools: [{ name: 'my_tool', inputSchema: {} }] }),
      )
      vi.mocked(mcpClient.callTool).mockResolvedValue({
        content: [{ type: 'text', text: 'tool result here' }],
      })

      await mcpManager.connect('caller')
      const result = await mcpManager.callTool('my_tool', { arg: 'val' })

      expect(result.content).toBe('tool result here')
      expect(result.isError).toBeUndefined()
    })

    it('returns error for unknown tool', async () => {
      const result = await mcpManager.callTool('unknown_tool', {})

      expect(result.isError).toBe(true)
      expect(result.content).toContain('No MCP server provides tool')
    })
  })

  describe('disconnect', () => {
    it('disconnects and removes from internal state', async () => {
      useMCPConfigStore.getState().addServer({
        id: 'disc',
        name: 'Disc',
        url: 'https://disc.test/mcp',
        authType: 'none',
        enabled: true,
        isDefault: false,
      })

      vi.mocked(mcpClient.connect).mockResolvedValue(
        makeConnection({ serverId: 'disc', tools: [{ name: 'disc_tool', inputSchema: {} }] }),
      )
      vi.mocked(mcpClient.disconnect).mockResolvedValue(undefined)

      await mcpManager.connect('disc')
      expect(mcpManager.getAvailableTools()).toHaveLength(1)

      await mcpManager.disconnect('disc')
      expect(mcpManager.getAvailableTools()).toHaveLength(0)
      expect(mcpClient.disconnect).toHaveBeenCalledTimes(1)
    })
  })
})
