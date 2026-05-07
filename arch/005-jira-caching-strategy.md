# ADR-005: Jira Caching Strategy

## Status: Accepted

## Context

Aegis renders a kanban board backed entirely by Jira Cloud REST API v3. There is no backend database — the browser is the only client. Jira Cloud imposes rate limits of approximately 100 requests per minute for OAuth apps. A board with 5 columns and 50+ issues triggers multiple API calls on every load. Drag-and-drop transitions must feel instant despite requiring a round-trip to Jira. Stale data is acceptable for seconds; lost mutations are not.

Key forces at play:

- **Rate limits**: 100 req/min means aggressive batching and caching are required
- **Latency**: Jira API calls from the browser typically take 200-800ms; drag-and-drop needs sub-100ms feedback
- **Freshness**: Board state should reflect reality within seconds, not minutes
- **Offline tolerance**: Brief network interruptions should not break the board mid-session
- **Zero infrastructure**: No backend cache layer available — caching must happen entirely in-browser

## Decision

### 1. Three-tier TTL strategy

Data is cached in IndexedDB via the `CacheStore` class with TTLs matched to data volatility:

| Data Category | TTL | Rationale |
|---|---|---|
| Board configurations (columns, status mappings) | 1 hour | Board structure changes rarely; safe to cache aggressively |
| Workflow/status metadata (statuses, workflows) | 24 hours | Workflow definitions almost never change within a day |
| User/team/component lists | 1 hour | Team membership is stable; hourly refresh catches new members |
| Issue snapshots (board issues, single issue) | 60 seconds | Issues change frequently; short TTL keeps data reasonably fresh |

The `JiraCache` class wraps `CacheStore` with typed methods and key prefixes for each category, enforcing these TTLs consistently.

### 2. Stale-while-revalidate via TanStack Query

TanStack Query manages the in-memory cache layer with `staleTime` values matching the IndexedDB TTLs. The flow for each query:

1. Check TanStack Query's in-memory cache (instant if fresh)
2. If stale, return cached data immediately and start background refetch
3. Background refetch checks IndexedDB first (fast)
4. If IndexedDB is also expired, make the Jira API call
5. Update both IndexedDB and TanStack Query caches with fresh data

Window focus triggers refetch for issue data (TanStack Query's `refetchOnWindowFocus: true`), ensuring the board is current when a developer returns to the tab.

### 3. Optimistic update pattern for drag-and-drop

Drag-and-drop transitions follow a five-step pattern to provide instant feedback:

1. **Optimistic UI update**: Zustand store records the issue's new target status. The board re-renders immediately with the card in its new column.
2. **Fetch transitions**: `GET /rest/api/3/issue/{key}/transitions` to get available transitions for the issue.
3. **Match target**: Find the transition whose target status matches the destination column.
4. **Execute or prompt**: If the transition has no required screen, execute it via `POST`. If it requires fields (e.g., resolution), show a modal before completing (rollback if cancelled).
5. **Rollback on failure**: If the API call fails, remove the optimistic update from the Zustand store. The card snaps back to its original column. TanStack Query invalidates the issue cache to fetch the authoritative state.

The optimistic update map in Zustand (`Map<issueKey, OptimisticUpdate>`) is separate from the TanStack Query cache. This ensures the query cache always reflects the server state, while the UI layer applies the optimistic overlay.

### 4. Rate limit mitigation

Four strategies minimize API calls:

- **Batch JQL queries**: A single `POST /rest/api/3/search` with JQL can return up to 100 issues in one call, rather than fetching issues individually. Board filters are translated to JQL clauses server-side.
- **Debounced refresh**: Text filter changes debounce before triggering a new query. Window focus refetch uses TanStack Query's built-in deduplication.
- **IndexedDB caching**: Frequently accessed data (board config, user lists, recent issues) is served from IndexedDB without any network call until the TTL expires.
- **Query deduplication**: TanStack Query automatically deduplicates in-flight requests. If two components request the same board config simultaneously, only one API call is made.

### 5. Cache invalidation on mutations

When a mutation succeeds (transition, field update):

1. The affected issue's IndexedDB cache entry is deleted (not just marked stale)
2. The board's issue list cache is also deleted
3. TanStack Query's corresponding query keys are invalidated, triggering fresh fetches
4. The optimistic update is removed from Zustand

This ensures the UI converges to the server state within one refetch cycle after any mutation.

## Consequences

**Positive:**
- Board loads feel fast: board config and user data are cached for an hour, so only issue data requires a network call
- Drag-and-drop provides instant visual feedback via optimistic updates
- Rate limits are respected: a typical board session generates 2-5 API calls per minute, well under the 100/min limit
- Tab switching triggers a quick refresh, keeping the board current for developers who alt-tab frequently
- IndexedDB persistence means even a hard refresh can show cached data immediately

**Negative:**
- 60-second issue TTL means a developer may see stale issue data for up to a minute (acceptable trade-off vs. rate limits)
- Optimistic updates add complexity: the UI must handle rollback gracefully, including cases where the transition requires fields
- IndexedDB cache can grow unbounded for users with many boards; the `evictExpired()` method must be called periodically
- Custom field IDs for story points vary by Jira instance; the client must check multiple candidate field IDs

## Alternatives Considered

- **No IndexedDB layer (TanStack Query only)**: Simpler, but every page refresh would hit the Jira API. Tab cycling in a busy workday would quickly exhaust rate limits. Rejected for rate limit safety.
- **Longer issue TTLs (5+ minutes)**: Would reduce API calls further but risk showing significantly stale board state. Developers would lose trust in the board's accuracy. Rejected.
- **Service Worker cache**: The SW already handles auth; adding a caching layer there would duplicate IndexedDB functionality and complicate the architecture. Rejected in favor of the app-layer `CacheStore`.
- **WebSocket/SSE for real-time updates**: Jira Cloud does not offer WebSocket APIs for issue changes. Webhooks require a server endpoint. Not feasible in a zero-infrastructure architecture. Rejected.
- **Pessimistic transitions (no optimistic UI)**: Simpler but results in a 500-800ms delay on every card drag where the card hangs mid-air. Rejected for poor UX.
