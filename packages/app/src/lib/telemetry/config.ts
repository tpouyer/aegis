import { type TelemetryConfig, useTelemetryStore } from '@/stores/telemetry'

export interface MCPDefaultServer {
  id: string
  name: string
  url: string
  authType: 'none' | 'bearer' | 'api-key'
  authProvider?: string
}

interface WellKnownConfig {
  telemetry?: {
    otlpEndpoint?: string | null
    exportIntervalMs?: number
    enabled?: boolean
  }
  auth?: {
    githubClientId?: string | null
    atlassianClientId?: string | null
    rhSsoIssuerUrl?: string | null
    rhSsoClientId?: string | null
    googleClientId?: string | null
    githubTokenProxyUrl?: string | null
  }
  mcp?: {
    defaultServers?: MCPDefaultServer[]
  }
}

let wellKnownCache: WellKnownConfig | null = null
let wellKnownFetched = false

export async function loadWellKnownConfig(): Promise<WellKnownConfig> {
  if (wellKnownCache) return wellKnownCache

  try {
    const base = import.meta.env.BASE_URL || '/'
    const response = await fetch(`${base}.well-known/aegis-configuration`)
    if (response.ok) {
      wellKnownCache = await response.json()
      wellKnownFetched = true
    }
  } catch {
    // .well-known not available — use defaults
  }

  return wellKnownCache ?? {}
}

export function getWellKnownConfig(): WellKnownConfig {
  return wellKnownCache ?? {}
}

export function isWellKnownLoaded(): boolean {
  return wellKnownFetched
}

/**
 * Resolve telemetry config with precedence:
 * 1. User localStorage override (Settings UI)
 * 2. .well-known/aegis-configuration (deployer config)
 * 3. VITE_OTEL_ENDPOINT env var (build-time)
 * 4. null (no export)
 */
export function getTelemetryConfig(): TelemetryConfig {
  const store = useTelemetryStore.getState()
  const wellKnown = wellKnownCache?.telemetry

  return {
    enabled: store.enabled,
    otlpEndpoint:
      store.otlpEndpoint || wellKnown?.otlpEndpoint || (import.meta.env.VITE_OTEL_ENDPOINT as string) || null,
    exportIntervalMs:
      store.exportIntervalMs !== 60_000 ? store.exportIntervalMs : (wellKnown?.exportIntervalMs ?? 60_000),
    localStorageEnabled: store.localStorageEnabled,
  }
}
