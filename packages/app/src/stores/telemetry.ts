import { create } from 'zustand'

export interface TelemetryConfig {
  enabled: boolean
  otlpEndpoint: string | null
  exportIntervalMs: number
  localStorageEnabled: boolean
}

const STORAGE_KEY = 'aegis_telemetry'

function getInitialConfig(): TelemetryConfig {
  const defaults: TelemetryConfig = {
    enabled: true,
    otlpEndpoint: null,
    exportIntervalMs: 60_000,
    localStorageEnabled: true,
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return { ...defaults, ...JSON.parse(stored) }
  } catch {
    /* noop */
  }

  return defaults
}

interface TelemetryStore extends TelemetryConfig {
  setEnabled: (enabled: boolean) => void
  setOtlpEndpoint: (endpoint: string | null) => void
  setExportInterval: (ms: number) => void
  setLocalStorageEnabled: (enabled: boolean) => void
}

function persist(config: TelemetryConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    /* noop */
  }
}

export const useTelemetryStore = create<TelemetryStore>((set, get) => ({
  ...getInitialConfig(),

  setEnabled: (enabled) => {
    set({ enabled })
    persist({ ...get(), enabled })
  },
  setOtlpEndpoint: (otlpEndpoint) => {
    set({ otlpEndpoint })
    persist({ ...get(), otlpEndpoint })
  },
  setExportInterval: (exportIntervalMs) => {
    set({ exportIntervalMs })
    persist({ ...get(), exportIntervalMs })
  },
  setLocalStorageEnabled: (localStorageEnabled) => {
    set({ localStorageEnabled })
    persist({ ...get(), localStorageEnabled })
  },
}))
