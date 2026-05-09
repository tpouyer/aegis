import { getMcpMeter } from '../meters'

const connectionDuration = getMcpMeter().createHistogram('mcp.connection.duration', {
  description: 'Time to establish MCP connection and discover tools',
  unit: 'ms',
})

const connectionErrors = getMcpMeter().createCounter('mcp.connection.error.count', {
  description: 'Failed MCP connection attempts',
  unit: '{error}',
})

const toolsDiscovered = getMcpMeter().createCounter('mcp.tools.discovered', {
  description: 'Number of tools discovered per server',
  unit: '{tool}',
})

const toolCallDuration = getMcpMeter().createHistogram('mcp.tool.call.duration', {
  description: 'Latency of MCP tool calls',
  unit: 'ms',
})

const toolCallErrors = getMcpMeter().createCounter('mcp.tool.call.error.count', {
  description: 'MCP tool call failures',
  unit: '{error}',
})

const activeSessions = getMcpMeter().createUpDownCounter('mcp.session.active', {
  description: 'Active MCP sessions',
  unit: '{session}',
})

export function recordMcpConnectionStart(serverId: string, serverName: string) {
  const startTime = performance.now()
  return {
    success(toolCount: number) {
      connectionDuration.record(performance.now() - startTime, { 'server.id': serverId, 'server.name': serverName })
      toolsDiscovered.add(toolCount, { 'server.id': serverId, 'server.name': serverName })
      activeSessions.add(1, { 'server.id': serverId })
    },
    error(errorType: string) {
      connectionErrors.add(1, { 'server.id': serverId, 'server.name': serverName, 'error.type': errorType })
    },
  }
}

export function recordMcpDisconnect(serverId: string) {
  activeSessions.add(-1, { 'server.id': serverId })
}

export function recordMcpToolCallStart(serverId: string, toolName: string) {
  const startTime = performance.now()
  return {
    end() {
      toolCallDuration.record(performance.now() - startTime, { 'server.id': serverId, 'tool.name': toolName })
    },
    error(errorType: string) {
      toolCallErrors.add(1, { 'server.id': serverId, 'tool.name': toolName, 'error.type': errorType })
    },
  }
}
