import type {
  PushMetricExporter,
  ResourceMetrics,
} from '@opentelemetry/sdk-metrics';
import type { ExportResult } from '@opentelemetry/core';

export class ConsoleMetricExporter implements PushMetricExporter {
  async export(
    metrics: ResourceMetrics,
    resultCallback: (result: ExportResult) => void,
  ): Promise<void> {
    for (const scopeMetrics of metrics.scopeMetrics) {
      for (const metric of scopeMetrics.metrics) {
        const points = metric.dataPoints;
        if (points.length === 0) continue;

        const values = points.map((dp) => {
          const attrs = Object.entries(dp.attributes)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          const val = 'value' in dp ? dp.value : dp;
          return `${val}${attrs ? ` {${attrs}}` : ''}`;
        });

        console.debug(
          `[OTEL] ${scopeMetrics.scope.name}/${metric.descriptor.name}: ${values.join('; ')}`,
        );
      }
    }

    resultCallback({ code: 0 });
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}

  selectAggregationTemporality(): 0 | 1 {
    return 1;
  }

  selectAggregation(): any {
    return undefined;
  }
}
