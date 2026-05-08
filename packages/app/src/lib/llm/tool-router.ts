/**
 * Tool router — dispatches tool calls from the LLM to the appropriate
 * handler and returns the result.
 *
 * Tool categories:
 *   - Content tools (coding_standards, testing_guidelines, architecture, etc.)
 *     -> Resolved from the WASM engine's manifest cache (instant, no network).
 *
 *   - org_context — returns sample organizational context for the current issue.
 *     -> Mock implementation for development and testing.
 *
 *   - MCP tools — any tool exposed by a connected external MCP server.
 *     -> Routed through the MCP client to the appropriate server.
 */

import { mcpManager } from '@/lib/mcp/manager'
import type { ToolCall, ToolResult } from './types'

// ---------------------------------------------------------------------------
// Debug logging
// ---------------------------------------------------------------------------

const DEBUG = import.meta.env.DEV

function logToolCall(toolCall: ToolCall): void {
  if (!DEBUG) return
  console.debug(`[tool-router] call: ${toolCall.name} (${toolCall.id})`, toolCall.arguments)
}

function logToolResult(result: ToolResult): void {
  if (!DEBUG) return
  const status = result.isError ? 'ERROR' : 'OK'
  console.debug(`[tool-router] result [${status}]: ${result.toolCallId}`, result.content.slice(0, 200))
}

// ---------------------------------------------------------------------------
// Tool sets
// ---------------------------------------------------------------------------

/** Content tool names that resolve from the WASM engine. */
const CONTENT_TOOLS = new Set([
  'coding_standards',
  'testing_guidelines',
  'architecture',
  'security_policy',
  'onboarding',
])

// ---------------------------------------------------------------------------
// Mock org context data
// ---------------------------------------------------------------------------

const MOCK_ORG_CONTEXT: Record<string, string> = {
  coding_standards: [
    '# Coding Standards',
    '',
    '- Use TypeScript strict mode for all source files.',
    '- Prefer functional components with hooks over class components.',
    '- Use named exports; avoid default exports except for route components.',
    '- Maximum line length: 100 characters.',
    '- All public functions must have JSDoc comments.',
  ].join('\n'),
  testing_guidelines: [
    '# Testing Guidelines',
    '',
    '- Write unit tests for all exported functions.',
    '- Use Vitest as the test runner; RTL for component tests.',
    '- Aim for 80% branch coverage on business logic.',
    '- Integration tests should mock network boundaries only.',
  ].join('\n'),
  architecture: [
    '# Architecture Overview',
    '',
    '- Monorepo with packages/app (React SPA) and packages/engine (Rust/WASM).',
    '- State management: Zustand stores scoped by feature.',
    '- LLM integration via provider abstraction (Anthropic, OpenAI, Ollama, custom).',
    '- Caching: IndexedDB with TTL-based expiration.',
    '- Routing: TanStack Router with file-based route definitions.',
  ].join('\n'),
  team_practices: [
    '# Team Practices',
    '',
    '- PRs require at least one approval before merge.',
    '- Commit messages follow Conventional Commits format.',
    '- Feature branches are prefixed with feat/, bugfix/, or chore/.',
    '- Sprint cadence: 2-week sprints with planning on Mondays.',
  ].join('\n'),
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Route a tool call to its handler and return the result.
 *
 * Errors during tool execution are caught and returned as error results
 * rather than propagated, keeping the streaming loop intact.
 */
export async function routeToolCall(toolCall: ToolCall): Promise<ToolResult> {
  logToolCall(toolCall)

  let result: ToolResult

  try {
    if (toolCall.name === 'org_context') {
      result = await resolveOrgContext(toolCall)
    } else if (CONTENT_TOOLS.has(toolCall.name)) {
      result = await resolveContentTool(toolCall)
    } else if (mcpManager.findServerForTool(toolCall.name)) {
      result = await routeToMCP(toolCall)
    } else {
      result = {
        toolCallId: toolCall.id,
        content: `Unknown tool: ${toolCall.name}`,
        isError: true,
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    result = {
      toolCallId: toolCall.id,
      content: `Tool execution failed: ${message}`,
      isError: true,
    }
  }

  logToolResult(result)
  return result
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

/**
 * Resolve mock organizational context.
 *
 * Accepts an optional `topic` argument to return a specific section,
 * or returns all available context when no topic is specified.
 */
async function resolveOrgContext(toolCall: ToolCall): Promise<ToolResult> {
  const topic = (toolCall.arguments.topic as string | undefined)?.toLowerCase()

  if (topic && MOCK_ORG_CONTEXT[topic]) {
    return {
      toolCallId: toolCall.id,
      content: MOCK_ORG_CONTEXT[topic],
    }
  }

  if (topic) {
    // Unknown topic — list available topics
    const available = Object.keys(MOCK_ORG_CONTEXT).join(', ')
    return {
      toolCallId: toolCall.id,
      content: `Topic "${topic}" not found. Available topics: ${available}`,
      isError: true,
    }
  }

  // No topic — return all context
  const allContext = Object.values(MOCK_ORG_CONTEXT).join('\n\n')
  return {
    toolCallId: toolCall.id,
    content: allContext,
  }
}

/**
 * Resolve a content tool from the WASM engine.
 * Stub: returns a placeholder until the engine is wired up.
 */
async function resolveContentTool(toolCall: ToolCall): Promise<ToolResult> {
  // TODO: Wire to WASM engine's ProxyEngine.resolve_content()
  // For now, return a stub that indicates the tool exists but
  // content resolution is not yet implemented.
  const repo = (toolCall.arguments.repo as string) ?? 'default'

  return {
    toolCallId: toolCall.id,
    content: `[${toolCall.name}] Content for repository "${repo}" will be resolved from the WASM engine manifest. This is a placeholder — the engine integration is pending.`,
  }
}

async function routeToMCP(toolCall: ToolCall): Promise<ToolResult> {
  const result = await mcpManager.callTool(toolCall.name, toolCall.arguments)
  return { ...result, toolCallId: toolCall.id }
}
