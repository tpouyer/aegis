# Feature: Resilient API Fetch Layer

## User Story
As a developer using the Aegis kanban board or IDE, I want API calls to automatically retry on transient failures with exponential backoff so that I am not blocked by momentary network hiccups or Jira/GitHub rate limits.

## Problem
Both the Jira client (`lib/jira/client.ts`) and the GitHub client hit cloud APIs that regularly return transient errors: 429 (rate limit), 502/503 (upstream flap), and network timeouts. The current `JiraClient.request()` method does a single `fetch()` and throws immediately on any non-2xx response. There is no retry logic, no backoff, and no rate-limit awareness. The design doc (section 13.1, 13.3) explicitly calls out Jira's ~100 req/min and GitHub's 5,000 req/hr limits as risks, but the mitigation ("aggressive caching, stale-while-revalidate") only reduces the frequency of calls -- it does not handle the case when a call actually fails.

In practice, a developer dragging several cards quickly on the kanban board can burst past the Jira rate limit. The result today: the optimistic UI rolls back, a generic error toast appears, and the user has to manually retry.

## Proposed Solution
Introduce a `ResilientFetch` wrapper that sits between the Jira/GitHub clients and native `fetch()`. Behavior:

1. **Automatic retry with exponential backoff** -- retry on 429, 500, 502, 503, 504, and network errors (TypeError). Max 3 retries with jitter: 500ms, 1000ms, 2000ms (plus 0-300ms random jitter).
2. **Rate-limit header awareness** -- on a 429, read `Retry-After` or `X-RateLimit-Reset` headers and defer until that timestamp instead of using a fixed backoff.
3. **Request deduplication** -- if two components request the same URL (GET) within a 100ms window, coalesce into a single in-flight fetch and share the response. This is common when the board and the detail panel both request the same issue simultaneously.
4. **Abort signal propagation** -- all retries are aborted if the caller's `AbortSignal` fires (e.g., the user navigates away).
5. **Observable status** -- expose a simple `isThrottled` boolean for UI consumption, so the header can show a "rate limited -- requests queued" indicator.

### API sketch

```typescript
interface ResilientFetchOptions {
  maxRetries?: number;       // default 3
  baseDelayMs?: number;      // default 500
  retryableStatuses?: Set<number>; // default {429,500,502,503,504}
  deduplicateGET?: boolean;  // default true
  signal?: AbortSignal;
}

function resilientFetch(
  url: string,
  init?: RequestInit,
  opts?: ResilientFetchOptions,
): Promise<Response>;
```

The Jira client and GitHub client adopt this by replacing their internal `fetch()` calls.

## Impact Assessment
- **User impact:** High -- eliminates the most common class of runtime errors for board and IDE users; prevents data loss from failed transitions.
- **Effort estimate:** S -- a single ~150-line utility module + two integration points (JiraClient, GitHubClient). No UI changes except an optional throttle indicator.
- **Risk:** Over-aggressive retry could amplify load during genuine outages. Mitigated by the jitter, the max-retry cap, and by respecting Retry-After headers.

## Competitive Analysis
- **VS Code / github.dev:** The GitHub REST client used by github.dev (via Octokit) includes built-in retry and throttling plugins (`@octokit/plugin-retry`, `@octokit/plugin-throttling`). These handle 429/5xx with exponential backoff and read `Retry-After`.
- **Slack Platform:** The Slack Web API SDK includes automatic rate-limit retry with a configurable queue depth. When the queue is full, it surfaces a clear error to the developer.
- **Figma Plugins:** The Figma REST API client retries on 429 and respects `Retry-After`. The plugin sandbox does not expose raw fetch, so retry is transparent.

## Technical Sketch
### New file
- `lib/fetch/resilient-fetch.ts` -- the retry/dedup/backoff wrapper.

### Modified files
- `lib/jira/client.ts` -- replace `fetch(url, init)` with `resilientFetch(url, init)` in `JiraClient.request()`.
- `lib/github/client.ts` -- same replacement in the GitHub client's internal request method. If Octokit is used, wire its `request.hook` to use the resilient layer instead.
- `stores/toast.ts` -- (optional) add a `warning` toast type so the throttle indicator can show an amber "Requests are being rate-limited" message rather than a red error.

### Not affected
- No changes to WASM engine, Service Worker, or build pipeline.
- No new dependencies.
