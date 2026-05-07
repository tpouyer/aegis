# Feature: Cache Eviction and Storage Quota Management

## User Story
As a developer who uses Aegis daily across multiple Jira boards and repos, I want the app to proactively manage its IndexedDB storage so that I never hit the browser storage quota and lose cached data silently.

## Problem
Aegis relies heavily on IndexedDB for persistence: Jira board/issue caches (`aegis-jira-cache`), chat session history (`aegis-chat`), VFS blob cache (`aegis-vfs`), and potentially more as features grow. The current `CacheStore` class (`lib/cache/indexeddb.ts`) supports TTL-based expiration and has an `evictExpired()` method, but:

1. **Nothing calls `evictExpired()`.** There is no scheduled or event-driven trigger for garbage collection. Expired entries sit in IndexedDB until they happen to be read (and then only return null -- they are not deleted).
2. **No quota awareness.** Browser storage quotas vary (Chrome: ~60% of disk per origin; Firefox: ~10%; Safari: 1GB with prompts). If Aegis exceeds quota during a `store.put()`, IndexedDB throws a `QuotaExceededError`. The current code wraps puts in promises but the rejection is unhandled at the call sites in `JiraCache` and `chatCache`.
3. **No LRU or priority eviction.** When space is tight, the system should preferentially evict low-value data (old search results, stale issue snapshots) before high-value data (chat sessions with hours of conversation, VFS blobs the user is actively editing).
4. **No user visibility.** Users have no way to see how much storage Aegis is using or to manually clear caches.

Over weeks of use, a power user could accumulate hundreds of MB of cached blobs and chat histories. In Safari (the strictest quota environment), this can silently fail.

## Proposed Solution

### 1. Periodic eviction scheduler
Add a lightweight scheduler that runs `evictExpired()` on all CacheStore instances:
- On app startup (after the Service Worker is ready).
- Every 15 minutes while the app is in the foreground.
- On `visibilitychange` when the tab becomes visible after being backgrounded for >5 minutes.

### 2. Quota-aware writes with graceful degradation
Wrap `CacheStore.set()` to catch `QuotaExceededError`. On quota exceeded:
- Run emergency eviction: delete all expired entries, then LRU-evict the oldest 25% of entries from the lowest-priority store.
- Retry the write once.
- If still failing, degrade gracefully: skip caching for this entry and surface a toast ("Storage full -- some data may load slower").

### 3. Storage budget per cache domain
Assign soft budgets:
- `aegis-jira-cache`: max 50MB (issue data is highly transient)
- `aegis-chat`: max 100MB (chat history is high-value)
- `aegis-vfs`: max 200MB (blob cache; content-addressed, so safe to evict)
When a domain exceeds its budget, evict oldest entries first.

### 4. Settings page storage panel
Add a "Storage" section to the `/settings` route showing:
- Per-cache usage (using `navigator.storage.estimate()` for total and per-database breakdown where available).
- "Clear cache" buttons per domain.
- "Clear all" button.

## Impact Assessment
- **User impact:** High -- prevents silent data loss and degraded performance for power users. Especially critical on Safari/iOS where quotas are restrictive.
- **Effort estimate:** M -- eviction scheduler is simple, but quota-aware writes and the settings panel require UI work and testing across browsers.
- **Risk:** Over-aggressive eviction could cause unnecessary cache misses, increasing API calls. Mitigated by conservative thresholds and by only running eviction on expired entries first.

## Competitive Analysis
- **VS Code / github.dev:** VS Code's IndexedDB usage is managed by the `StorageService` which tracks per-workspace quotas and evicts old workspace data. github.dev uses a similar approach with a storage cleanup task that runs on startup.
- **Figma:** Figma aggressively manages its local cache; the desktop app has a "Clear cache" option in preferences, and the web app runs periodic cleanup.
- **Slack:** The Slack web client uses a storage budget per workspace and evicts oldest messages/file previews first. It shows a clear "Cache cleared" confirmation when the user triggers manual cleanup.

## Technical Sketch
### New files
- `lib/cache/eviction-scheduler.ts` -- scheduler that coordinates eviction across all CacheStore instances.
- `lib/cache/quota-manager.ts` -- quota estimation, budget enforcement, emergency eviction.

### Modified files
- `lib/cache/indexeddb.ts` -- add `getEntryCount()` and `getOldestEntries(n)` methods to support LRU eviction. Add `QuotaExceededError` handling in `set()` and `setMany()`.
- `lib/jira/cache.ts` -- register the JiraCache store with the eviction scheduler.
- `stores/chat.ts` -- register the chat cache store with the eviction scheduler.
- `lib/vfs/cache.ts` -- register the VFS blob cache with the eviction scheduler.
- `routes/settings.tsx` -- add a "Storage" section with usage display and clear buttons.
- `main.tsx` -- initialize the eviction scheduler on app startup.

### Not affected
- No changes to WASM engine, Service Worker, or build pipeline.
- No new external dependencies (`navigator.storage.estimate()` is available in all target browsers).
