import { type Meter, metrics } from '@opentelemetry/api'

let httpMeter: Meter | null = null
let llmMeter: Meter | null = null
let navMeter: Meter | null = null
let swMeter: Meter | null = null
let mcpMeter: Meter | null = null
let skillsMeter: Meter | null = null
let toolRouterMeter: Meter | null = null
let workspaceMeter: Meter | null = null
let boardMeter: Meter | null = null

export function getHttpMeter(): Meter {
  if (!httpMeter) httpMeter = metrics.getMeter('aegis.http', '0.1.0')
  return httpMeter
}

export function getLlmMeter(): Meter {
  if (!llmMeter) llmMeter = metrics.getMeter('aegis.llm', '0.1.0')
  return llmMeter
}

export function getNavMeter(): Meter {
  if (!navMeter) navMeter = metrics.getMeter('aegis.navigation', '0.1.0')
  return navMeter
}

export function getSwMeter(): Meter {
  if (!swMeter) swMeter = metrics.getMeter('aegis.sw', '0.1.0')
  return swMeter
}

export function getMcpMeter(): Meter {
  if (!mcpMeter) mcpMeter = metrics.getMeter('aegis.mcp', '0.1.0')
  return mcpMeter
}

export function getSkillsMeter(): Meter {
  if (!skillsMeter) skillsMeter = metrics.getMeter('aegis.skills', '0.1.0')
  return skillsMeter
}

export function getToolRouterMeter(): Meter {
  if (!toolRouterMeter) toolRouterMeter = metrics.getMeter('aegis.tool_router', '0.1.0')
  return toolRouterMeter
}

export function getWorkspaceMeter(): Meter {
  if (!workspaceMeter) workspaceMeter = metrics.getMeter('aegis.workspace', '0.1.0')
  return workspaceMeter
}

export function getBoardMeter(): Meter {
  if (!boardMeter) boardMeter = metrics.getMeter('aegis.board', '0.1.0')
  return boardMeter
}

export function resetMeters(): void {
  httpMeter = null
  llmMeter = null
  navMeter = null
  swMeter = null
  mcpMeter = null
  skillsMeter = null
  toolRouterMeter = null
  workspaceMeter = null
  boardMeter = null
}
