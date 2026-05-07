import { metrics } from '@opentelemetry/api'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { getTelemetryConfig, loadWellKnownConfig } from './config'
import { ConsoleMetricExporter } from './exporters/console'
import { resetMeters } from './meters'

let _meterProvider: MeterProvider | null = null

function createProvider(): () => void {
  const config = getTelemetryConfig()

  if (!config.enabled) {
    return () => {}
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'aegis-app',
    [ATTR_SERVICE_VERSION]: '0.1.0',
  })

  const readers: PeriodicExportingMetricReader[] = []

  if (import.meta.env.DEV) {
    readers.push(
      new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: 15_000,
      }),
    )
  }

  if (config.otlpEndpoint) {
    readers.push(
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: config.otlpEndpoint }),
        exportIntervalMillis: config.exportIntervalMs,
      }),
    )
  }

  const provider = new MeterProvider({ resource, readers })

  metrics.setGlobalMeterProvider(provider)
  _meterProvider = provider
  resetMeters()

  const shutdown = () => {
    provider.shutdown().catch(() => {})
    _meterProvider = null
  }

  window.addEventListener('beforeunload', shutdown)

  return () => {
    window.removeEventListener('beforeunload', shutdown)
    shutdown()
  }
}

/**
 * Initialize telemetry. Loads .well-known/aegis-configuration first
 * to pick up deployer-configured OTLP endpoint, then creates the
 * MeterProvider with the resolved config.
 */
export async function initTelemetry(): Promise<() => void> {
  await loadWellKnownConfig()
  return createProvider()
}
