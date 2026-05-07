import { useTelemetryStore, type TelemetryConfig } from '@/stores/telemetry';

export function getTelemetryConfig(): TelemetryConfig {
  const store = useTelemetryStore.getState();
  return {
    enabled: store.enabled,
    otlpEndpoint: store.otlpEndpoint || (import.meta.env.VITE_OTEL_ENDPOINT as string) || null,
    exportIntervalMs: store.exportIntervalMs,
    localStorageEnabled: store.localStorageEnabled,
  };
}
