/**
 * Tool router — dispatches tool calls from the LLM to the appropriate
 * handler and returns the result.
 *
 * Tool categories:
 *   - Content tools (coding_standards, testing_guidelines, architecture, etc.)
 *     → Resolved from the WASM engine's manifest cache (instant, no network).
 *     → Currently stubbed; will be wired to the ProxyEngine when available.
 *
 *   - Search / execute tools
 *     → Routed through the Service Worker to upstream MCP servers.
 *     → Currently stubbed; will be implemented in the Tool Aggregation phase.
 */

import type { ToolCall, ToolResult } from './types';

/** Content tool names that resolve from the WASM engine. */
const CONTENT_TOOLS = new Set([
  'coding_standards',
  'testing_guidelines',
  'architecture',
  'security_policy',
  'onboarding',
]);

/**
 * Route a tool call to its handler and return the result.
 */
export async function routeToolCall(toolCall: ToolCall): Promise<ToolResult> {
  if (CONTENT_TOOLS.has(toolCall.name)) {
    return resolveContentTool(toolCall);
  }

  if (toolCall.name === 'search' || toolCall.name === 'execute') {
    return routeToMCP(toolCall);
  }

  return {
    toolCallId: toolCall.id,
    content: `Unknown tool: ${toolCall.name}`,
    isError: true,
  };
}

/**
 * Resolve a content tool from the WASM engine.
 * Stub: returns a placeholder until the engine is wired up.
 */
async function resolveContentTool(toolCall: ToolCall): Promise<ToolResult> {
  // TODO: Wire to WASM engine's ProxyEngine.resolve_content()
  // For now, return a stub that indicates the tool exists but
  // content resolution is not yet implemented.
  const repo = (toolCall.arguments.repo as string) ?? 'default';

  return {
    toolCallId: toolCall.id,
    content: `[${toolCall.name}] Content for repository "${repo}" will be resolved from the WASM engine manifest. This is a placeholder — the engine integration is pending.`,
  };
}

/**
 * Route a search/execute tool call through the Service Worker to
 * upstream MCP servers.
 * Stub: returns a placeholder until the SW MCP proxy is implemented.
 */
async function routeToMCP(toolCall: ToolCall): Promise<ToolResult> {
  // TODO: postMessage to Service Worker with MCP tool call
  // SW will route to the appropriate upstream MCP server.
  return {
    toolCallId: toolCall.id,
    content: `[${toolCall.name}] MCP tool execution is not yet available. The Service Worker MCP proxy will be implemented in the Tool Aggregation phase.`,
  };
}
