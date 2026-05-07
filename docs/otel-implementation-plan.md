# Plan: Add OpenTelemetry Metrics to Aegis

## Context
Aegis is a browser-only SPA with no backend. It needs observability into HTTP request performance, LLM streaming latency/token usage, route navigation timing, and Service Worker cache behavior. OTEL provides a vendor-neutral standard. Since there's no backend, metrics export to a configurable OTLP endpoint (for users with a collector), console in dev, and IndexedDB for local retention.

## Packages to Install
```
@opentelemetry/api
@opentelemetry/sdk-metrics
@opentelemetry/resources
@opentelemetry/semantic-conventions
@opentelemetry/exporter-metrics-otlp-http
```
~60-80KB gzipped. Current bundle is 884KB; budget is 5-6MB.

## New Files

```
src/lib/telemetry/
  init.ts              — MeterProvider setup, lifecycle, shutdown on beforeunload
  config.ts            — Read TelemetryConfig from store/env
  meters.ts            — Singleton Meter getters (getHttpMeter, getLlmMeter, etc.)
  utils.ts             — extractUrlTemplate() to sanitize URLs for low-cardinality attributes
  instruments/
    http.ts            — Counters/histograms for resilientFetch
    llm.ts             — instrumentedChat() async generator wrapper
    navigation.ts      — Route change timing + Web Vitals (LCP, FID, CLS)
    service-worker.ts  — postMessage bridge for SW metric events
  exporters/
    console.ts         — Dev-mode ConsoleMetricExporter
    indexeddb.ts       — Local storage exporter using existing CacheStore
  __tests__/
    (8 test files)

src/stores/telemetry.ts — Zustand config store (enabled, otlpEndpoint, intervals)
```

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add 5 OTEL deps |
| `src/main.tsx` | Call `initTelemetry()`, `instrumentNavigation(router)` |
| `src/lib/fetch/resilient-fetch.ts` | Add ~20 lines: record duration, retries, errors, active count |
| `src/components/chat/ChatView.tsx` | Wrap `provider.chat()` with `instrumentedChat()` (1-line change) |
| `src/lib/llm/types.ts` | Add optional `usage` field to `ChatChunk` |
| `src/routes/settings.tsx` | Add "Telemetry" tab |
| `vite.config.ts` | Add `'otel'` to manualChunks |

## Metrics Collected

**HTTP** (`resilientFetch`): `http.client.request.duration` (histogram), `http.client.request.retry.count` (counter), `http.client.request.error.count` (counter), `http.client.active_requests` (updown counter)

**LLM** (chat streaming): `gen_ai.client.operation.duration` (histogram), `gen_ai.client.token.usage` (counter), `gen_ai.client.time_to_first_token` (histogram), `gen_ai.client.request.error.count` (counter)

**Navigation**: `browser.page.navigation.duration`, `browser.page.load.duration`, `browser.web_vital.lcp/fid/cls`

**Service Worker**: `sw.cache.hit/miss.count`, `sw.relay.request/error.count`, `sw.token.expiry.count`

## Key Design Decisions
1. **No-op when disabled**: OTEL API returns no-op instruments when no MeterProvider registered → zero overhead in tests and when disabled
2. **No provider file changes**: `instrumentedChat()` wraps the stream transparently in ChatView
3. **Public API unchanged**: `resilientFetch()` signature unchanged — instrumentation is internal
4. **Three exporters**: Console (dev), OTLP/HTTP (configurable), IndexedDB (local retention)
5. **Runtime reconfiguration**: Settings changes re-init the MeterProvider without page reload

## Implementation Sequence
1. Install packages, create telemetry module skeleton, Zustand store, wire `initTelemetry()`
2. Instrument `resilientFetch()` with HTTP metrics
3. Create `instrumentedChat()` and wire into ChatView
4. Add route navigation + Web Vitals instruments
5. Build console and IndexedDB exporters
6. Add Telemetry tab to Settings
7. Add SW metric bridge

## Verification
- Run `npm run test` after each phase — all 305 existing tests must pass (OTEL is no-op in test env)
- Run `npm run build` — verify bundle size stays under budget
- Start dev server, open console — verify metric logs appear on API calls and route changes
- Configure OTLP endpoint in Settings — verify metrics export
