import { getToolRouterMeter } from '../meters'

const dispatchCount = getToolRouterMeter().createCounter('tool_router.dispatch.count', {
  description: 'Tool calls routed by category',
  unit: '{call}',
})

const dispatchDuration = getToolRouterMeter().createHistogram('tool_router.dispatch.duration', {
  description: 'End-to-end latency of tool dispatch',
  unit: 'ms',
})

const dispatchErrors = getToolRouterMeter().createCounter('tool_router.dispatch.error.count', {
  description: 'Failed tool dispatches',
  unit: '{error}',
})

const unknownToolCount = getToolRouterMeter().createCounter('tool_router.unknown_tool.count', {
  description: 'Calls to undefined tools',
  unit: '{call}',
})

export type ToolCategory = 'content' | 'org_context' | 'mcp' | 'skill' | 'execution' | 'workspace' | 'unknown'

export function recordToolDispatchStart(toolName: string, category: ToolCategory) {
  const startTime = performance.now()
  dispatchCount.add(1, { 'tool.name': toolName, 'tool.category': category })

  return {
    end() {
      dispatchDuration.record(performance.now() - startTime, { 'tool.name': toolName, 'tool.category': category })
    },
    error(errorType: string) {
      dispatchDuration.record(performance.now() - startTime, { 'tool.name': toolName, 'tool.category': category })
      dispatchErrors.add(1, { 'tool.name': toolName, 'tool.category': category, 'error.type': errorType })
    },
  }
}

export function recordUnknownTool(toolName: string) {
  unknownToolCount.add(1, { 'tool.name': toolName })
}
