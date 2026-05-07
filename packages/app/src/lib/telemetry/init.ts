import { metrics } from '@opentelemetry/api';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { ConsoleMetricExporter } from './exporters/console';
import { getTelemetryConfig } from './config';
import { resetMeters } from './meters';

let meterProvider: MeterProvider | null = null;

export function initTelemetry(): () => void {
  const config = getTelemetryConfig();

  if (!config.enabled) {
    return () => {};
  }

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: 'aegis-app',
    [ATTR_SERVICE_VERSION]: '0.1.0',
  });

  const provider = new MeterProvider({ resource });
  const readers: PeriodicExportingMetricReader[] = [];

  if (import.meta.env.DEV) {
    const reader = new PeriodicExportingMetricReader({
      exporter: new ConsoleMetricExporter(),
      exportIntervalMillis: 15_000,
    });
    provider.addMetricReader(reader);
    readers.push(reader);
  }

  if (config.otlpEndpoint) {
    const reader = new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: config.otlpEndpoint }),
      exportIntervalMillis: config.exportIntervalMs,
    });
    provider.addMetricReader(reader);
    readers.push(reader);
  }

  metrics.setGlobalMeterProvider(provider);
  meterProvider = provider;
  resetMeters();

  const shutdown = () => {
    provider.shutdown().catch(() => {});
    meterProvider = null;
  };

  window.addEventListener('beforeunload', shutdown);

  return () => {
    window.removeEventListener('beforeunload', shutdown);
    shutdown();
  };
}
