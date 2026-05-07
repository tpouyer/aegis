# OpenTelemetry Metrics — Implementation Record

## Context
Aegis is a browser-only SPA with no backend. It needs observability into HTTP request performance, LLM streaming latency/token usage, route navigation timing, and Service Worker cache behavior. OTEL provides a vendor-neutral standard. Since there's no backend, metrics export to a configurable OTLP endpoint (for users with a collector) or console in dev.

## Status: Implemented

## Packages Installed
```
@opentelemetry/api
@opentelemetry/sdk-metrics
@opentelemetry/resources
@opentelemetry/semantic-conventions
@opentelemetry/exporter-metrics-otlp-http
```
Separated into `otel` manual chunk in `vite.config.ts` for bundle splitting.

## Files Created

```
src/lib/telemetry/
  init.ts              — Async MeterProvider setup; loads .well-known config first
  config.ts            — Three-tier config resolution + .well-known loader/cache
  meters.ts            — Singleton Meter getters (HTTP, LLM, Navigation, SW)
  utils.ts             — extractUrlTemplate() for low-cardinality URL attributes
  instruments/
    http.ts            — recordHttpStart() → { end, retry, error } tracker
    llm.ts             — instrumentedChat() async generator wrapper
    navigation.ts      — instrumentNavigation(router) + PerformanceObserver Web Vitals
  exporters/
    console.ts         — Dev-mode ConsoleMetricExporter (15s interval)

src/stores/telemetry.ts — Zustand config store (enabled, endpoint, interval, localStorage toggle)

public/.well-known/aegis-configuration — Runtime deployment config (OTLP endpoint + auth client IDs)
```

## Files Modified

| File | Change |
|------|--------|
| `package.json` | 5 OTEL dependencies added |
| `src/main.tsx` | Async `bootstrap()` calls `initTelemetry()` + `instrumentNavigation(router)` |
| `src/lib/fetch/resilient-fetch.ts` | `recordHttpStart()` metrics at request/retry/error/success points |
| `src/components/chat/ChatView.tsx` | `instrumentedChat()` wrapping the LLM stream |
| `src/routes/settings.tsx` | Telemetry tab (enable/disable, OTLP endpoint, interval, local storage) |
| `src/lib/auth/config.ts` | Reads auth client IDs from `.well-known` with env var fallback |
| `vite.config.ts` | `'otel'` manual chunk |

## Metrics Collected

**HTTP** (`resilientFetch`):
- `http.client.request.duration` — histogram (ms), attrs: `url.template`, `http.response.status_code`, `http.request.resend_count`
- `http.client.request.retry.count` — counter, attr: `url.template`
- `http.client.request.error.count` — counter, attrs: `url.template`, `error.type`
- `http.client.active_requests` — updown counter, attr: `url.template`

**LLM** (chat streaming):
- `gen_ai.client.operation.duration` — histogram (ms), attrs: `gen_ai.system`, `gen_ai.request.model`
- `gen_ai.client.time_to_first_token` — histogram (ms)
- `gen_ai.client.token.usage` — counter ({token}), attr: `gen_ai.token.type`
- `gen_ai.client.request.error.count` — counter, attr: `error.type`

**Navigation**:
- `browser.page.navigation.duration` — histogram (ms), attrs: `browser.page.route`, `browser.page.previous_route`
- `browser.page.load.duration` — histogram (ms)
- `browser.web_vital.lcp` — histogram (ms)
- `browser.web_vital.fid` — histogram (ms)
- `browser.web_vital.cls` — histogram ({score})

## Configuration

Three-tier resolution (first non-null wins):
1. **User localStorage** (Settings UI) — personal override
2. **`.well-known/aegis-configuration`** — deployer sets OTLP endpoint without rebuilding
3. **`VITE_OTEL_ENDPOINT`** — build-time developer default

Settings UI (Settings > Preferences tab, telemetry section) provides:
- Enable/disable toggle
- OTLP endpoint URL input
- Export interval selector (15s / 30s / 1m / 5m)
- Local storage metrics toggle

## Key Design Decisions
1. **No-op when disabled**: OTEL API returns no-op instruments when no MeterProvider registered — zero overhead in tests
2. **No provider file changes**: `instrumentedChat()` wraps the stream transparently
3. **Public APIs unchanged**: `resilientFetch()` signature identical
4. **Async init**: `initTelemetry()` is async to load `.well-known` config before creating the MeterProvider
5. **URL sanitization**: `extractUrlTemplate()` strips dynamic segments (UUIDs, issue keys, numeric IDs) to keep metric cardinality low
