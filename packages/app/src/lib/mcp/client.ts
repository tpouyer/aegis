import type { MCPServerConfig } from '@/stores/mcp-config'
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  MCPConnection,
  MCPInitializeResult,
  MCPToolCallResult,
  MCPToolInfo,
} from './types'

const DEBUG = import.meta.env.DEV
const PROTOCOL_VERSION = '2025-03-26'
const CLIENT_INFO = { name: 'aegis', version: '0.1.0' }

function log(msg: string, ...args: unknown[]) {
  if (DEBUG) console.debug(`[mcp-client] ${msg}`, ...args)
}

let requestId = 0
function nextId(): number {
  return ++requestId
}

function buildHeaders(config: MCPServerConfig, sessionId: string | null): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  })
  if (sessionId) {
    headers.set('Mcp-Session-Id', sessionId)
  }
  if (config.authType === 'bearer' && config.authToken) {
    headers.set('Authorization', `Bearer ${config.authToken}`)
  } else if (config.authType === 'api-key' && config.authToken) {
    headers.set('x-api-key', config.authToken)
  }
  return headers
}

async function sendRequest(
  url: string,
  body: JSONRPCRequest,
  headers: Headers,
): Promise<{ response: Response; json: JSONRPCResponse }> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`MCP request failed: ${response.status} ${response.statusText}`)
  }
  const json = (await response.json()) as JSONRPCResponse
  if (json.error) {
    throw new Error(`MCP error ${json.error.code}: ${json.error.message}`)
  }
  return { response, json }
}

async function sendNotification(url: string, body: JSONRPCRequest, headers: Headers): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!response.ok && response.status !== 202 && response.status !== 204) {
    log('notification response not ok:', response.status)
  }
}

export async function connect(config: MCPServerConfig): Promise<MCPConnection> {
  const conn: MCPConnection = {
    serverId: config.id,
    serverName: config.name,
    sessionId: null,
    tools: [],
    status: 'connecting',
  }

  try {
    log('initializing connection to %s (%s)', config.name, config.url)

    const initHeaders = buildHeaders(config, null)
    const initReq: JSONRPCRequest = {
      jsonrpc: '2.0',
      method: 'initialize',
      id: nextId(),
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: CLIENT_INFO,
      },
    }

    const { response: initResponse, json: initJson } = await sendRequest(config.url, initReq, initHeaders)
    const initResult = initJson.result as MCPInitializeResult
    conn.sessionId = initResponse.headers.get('Mcp-Session-Id')
    log(
      'initialized: server=%s v%s, session=%s',
      initResult.serverInfo.name,
      initResult.serverInfo.version,
      conn.sessionId,
    )

    const sessionHeaders = buildHeaders(config, conn.sessionId)
    await sendNotification(config.url, { jsonrpc: '2.0', method: 'notifications/initialized' }, sessionHeaders)

    const toolsReq: JSONRPCRequest = {
      jsonrpc: '2.0',
      method: 'tools/list',
      id: nextId(),
      params: {},
    }
    const { json: toolsJson } = await sendRequest(config.url, toolsReq, sessionHeaders)
    const toolsResult = toolsJson.result as { tools: MCPToolInfo[] }
    conn.tools = toolsResult.tools ?? []
    conn.status = 'connected'
    log('discovered %d tools from %s', conn.tools.length, config.name)
  } catch (err) {
    conn.status = 'error'
    conn.error = err instanceof Error ? err.message : String(err)
    log('connection failed: %s', conn.error)
  }

  return conn
}

export async function callTool(
  config: MCPServerConfig,
  connection: MCPConnection,
  toolName: string,
  args: Record<string, unknown>,
): Promise<MCPToolCallResult> {
  if (connection.status !== 'connected') {
    throw new Error(`Cannot call tool on ${connection.serverName}: status is ${connection.status}`)
  }

  const headers = buildHeaders(config, connection.sessionId)
  const req: JSONRPCRequest = {
    jsonrpc: '2.0',
    method: 'tools/call',
    id: nextId(),
    params: { name: toolName, arguments: args },
  }

  log('calling tool %s on %s', toolName, connection.serverName)
  const { json } = await sendRequest(config.url, req, headers)
  return json.result as MCPToolCallResult
}

export async function disconnect(config: MCPServerConfig, connection: MCPConnection): Promise<void> {
  if (!connection.sessionId) return
  try {
    const headers = buildHeaders(config, connection.sessionId)
    await fetch(config.url, { method: 'DELETE', headers })
    log('disconnected from %s', connection.serverName)
  } catch {
    log('disconnect cleanup failed for %s (non-fatal)', connection.serverName)
  }
}
