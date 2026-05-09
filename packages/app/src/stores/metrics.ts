import { create } from 'zustand'

export interface MetricDataPoint {
  value: number
  attributes: Record<string, string | number>
  timestamp: number
}

export interface MetricSnapshot {
  name: string
  description: string
  unit: string
  type: 'histogram' | 'counter' | 'up_down_counter'
  dataPoints: MetricDataPoint[]
  history: number[]
}

interface MetricsStore {
  byMeter: Map<string, MetricSnapshot[]>
  lastUpdated: number
  updateFromExport: (scopeName: string, metrics: MetricSnapshot[]) => void
  clear: () => void
}

const MAX_HISTORY = 30

export const useMetricsStore = create<MetricsStore>((set, get) => ({
  byMeter: new Map(),
  lastUpdated: 0,

  updateFromExport: (scopeName, newMetrics) => {
    const { byMeter } = get()
    const updated = new Map(byMeter)
    const existing = updated.get(scopeName) ?? []

    const merged = newMetrics.map((incoming) => {
      const prev = existing.find((m) => m.name === incoming.name)
      const avgValue =
        incoming.dataPoints.length > 0
          ? incoming.dataPoints.reduce((sum, dp) => sum + dp.value, 0) / incoming.dataPoints.length
          : 0
      const history = prev ? [...prev.history, avgValue].slice(-MAX_HISTORY) : [avgValue]
      return { ...incoming, history }
    })

    updated.set(scopeName, merged)
    set({ byMeter: updated, lastUpdated: Date.now() })
  },

  clear: () => {
    set({ byMeter: new Map(), lastUpdated: 0 })
  },
}))
