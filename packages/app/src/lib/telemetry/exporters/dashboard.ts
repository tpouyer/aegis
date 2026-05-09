import type { ExportResult } from '@opentelemetry/core'
import type { PushMetricExporter, ResourceMetrics } from '@opentelemetry/sdk-metrics'
import type { MetricDataPoint, MetricSnapshot } from '@/stores/metrics'
import { useMetricsStore } from '@/stores/metrics'

export class DashboardMetricExporter implements PushMetricExporter {
  async export(metrics: ResourceMetrics, resultCallback: (result: ExportResult) => void): Promise<void> {
    const { updateFromExport } = useMetricsStore.getState()

    for (const scopeMetrics of metrics.scopeMetrics) {
      const scopeName = scopeMetrics.scope.name
      const snapshots: MetricSnapshot[] = []

      for (const metric of scopeMetrics.metrics) {
        if (metric.dataPoints.length === 0) continue

        const type = inferMetricType(metric.dataPointType)
        const dataPoints: MetricDataPoint[] = metric.dataPoints.map((dp) => {
          const attrs: Record<string, string | number> = {}
          for (const [k, v] of Object.entries(dp.attributes)) {
            attrs[k] = typeof v === 'number' ? v : String(v)
          }

          let value: number
          if ('value' in dp && typeof dp.value === 'number') {
            value = dp.value
          } else if ('value' in dp && typeof dp.value === 'object' && dp.value !== null) {
            const hv = dp.value as { sum?: number; count?: number }
            value = hv.count && hv.count > 0 ? (hv.sum ?? 0) / hv.count : 0
          } else {
            value = 0
          }

          return { value, attributes: attrs, timestamp: Date.now() }
        })

        snapshots.push({
          name: metric.descriptor.name,
          description: metric.descriptor.description ?? '',
          unit: metric.descriptor.unit ?? '',
          type,
          dataPoints,
          history: [],
        })
      }

      if (snapshots.length > 0) {
        updateFromExport(scopeName, snapshots)
      }
    }

    resultCallback({ code: 0 })
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}

  selectAggregationTemporality(): 0 | 1 {
    return 1
  }
}

function inferMetricType(dataPointType: number): MetricSnapshot['type'] {
  switch (dataPointType) {
    case 0:
      return 'histogram'
    case 2:
      return 'histogram'
    default:
      return 'counter'
  }
}
