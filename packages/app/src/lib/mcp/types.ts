export interface JSONRPCRequest {
  jsonrpc: '2.0'
  method: string
  id?: number | string
  params?: Record<string, unknown>
}

export interface JSONRPCResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export interface MCPToolInfo {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

export interface MCPInitializeResult {
  protocolVersion: string
  capabilities: Record<string, unknown>
  serverInfo: { name: string; version: string }
}

export interface MCPToolCallResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>
  isError?: boolean
}

export interface MCPConnection {
  serverId: string
  serverName: string
  sessionId: string | null
  tools: MCPToolInfo[]
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  error?: string
}
