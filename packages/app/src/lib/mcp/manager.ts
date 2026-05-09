import type { ToolDefinition, ToolResult } from '@/lib/llm/types'
import { recordMcpDisconnect } from '@/lib/telemetry/instruments/mcp'
import type { MCPServerConfig } from '@/stores/mcp-config'
import { useMCPConfigStore } from '@/stores/mcp-config'
import * as mcpClient from './client'
import type { MCPConnection } from './types'

const DEBUG = import.meta.env.DEV

function log(msg: string, ...args: unknown[]) {
  if (DEBUG) console.debug(`[mcp-manager] ${msg}`, ...args)
}

export interface TaggedToolDefinition extends ToolDefinition {
  serverId: string
  serverName: string
}

class MCPConnectionManager {
  private connections = new Map<string, MCPConnection>()
  private configs = new Map<string, MCPServerConfig>()

  async connectAll(): Promise<void> {
    const { servers } = useMCPConfigStore.getState()
    const enabled = servers.filter((s) => s.enabled)
    log('connecting to %d enabled servers', enabled.length)
    await Promise.allSettled(enabled.map((s) => this.connect(s.id)))
  }

  async connect(serverId: string): Promise<MCPConnection | undefined> {
    const { servers } = useMCPConfigStore.getState()
    const config = servers.find((s) => s.id === serverId)
    if (!config) {
      log('server config not found: %s', serverId)
      return undefined
    }

    const existing = this.connections.get(serverId)
    if (existing?.status === 'connected') {
      return existing
    }

    this.configs.set(serverId, config)
    const connection = await mcpClient.connect(config)
    this.connections.set(serverId, connection)
    return connection
  }

  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId)
    const config = this.configs.get(serverId)
    if (connection && config) {
      await mcpClient.disconnect(config, connection)
      recordMcpDisconnect(serverId)
    }
    this.connections.delete(serverId)
    this.configs.delete(serverId)
  }

  async disconnectAll(): Promise<void> {
    const ids = [...this.connections.keys()]
    await Promise.allSettled(ids.map((id) => this.disconnect(id)))
  }

  getAvailableTools(): TaggedToolDefinition[] {
    const tools: TaggedToolDefinition[] = []
    for (const conn of this.connections.values()) {
      if (conn.status !== 'connected') continue
      for (const tool of conn.tools) {
        tools.push({
          name: tool.name,
          description: tool.description ?? '',
          inputSchema: tool.inputSchema,
          serverId: conn.serverId,
          serverName: conn.serverName,
        })
      }
    }
    return tools
  }

  findServerForTool(toolName: string): MCPConnection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.status !== 'connected') continue
      if (conn.tools.some((t) => t.name === toolName)) {
        return conn
      }
    }
    return undefined
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const conn = this.findServerForTool(toolName)
    if (!conn) {
      return { toolCallId: '', content: `No MCP server provides tool: ${toolName}`, isError: true }
    }

    const config = this.configs.get(conn.serverId)
    if (!config) {
      return { toolCallId: '', content: `Config missing for server: ${conn.serverName}`, isError: true }
    }

    try {
      const result = await mcpClient.callTool(config, conn, toolName, args)
      const text = result.content.map((c) => c.text ?? JSON.stringify(c)).join('\n')
      return { toolCallId: '', content: text, isError: result.isError }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { toolCallId: '', content: `MCP tool call failed: ${message}`, isError: true }
    }
  }

  getConnectionStatus(): Map<string, MCPConnection> {
    return new Map(this.connections)
  }

  getConnection(serverId: string): MCPConnection | undefined {
    return this.connections.get(serverId)
  }
}

export const mcpManager = new MCPConnectionManager()
