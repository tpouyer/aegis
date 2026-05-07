import { type Meter, metrics } from '@opentelemetry/api'

let httpMeter: Meter | null = null
let llmMeter: Meter | null = null
let navMeter: Meter | null = null
let swMeter: Meter | null = null

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

export function resetMeters(): void {
  httpMeter = null
  llmMeter = null
  navMeter = null
  swMeter = null
}
