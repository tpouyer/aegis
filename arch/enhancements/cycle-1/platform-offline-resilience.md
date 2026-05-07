# Feature: Offline Resilience and Mutation Queue

## User Story
As a developer working on a flaky network (airplane, conference, VPN), I want Aegis to let me keep working with cached data and queue my mutations so that I do not lose work when connectivity drops.

## Problem
The design doc (section 12, strength 7) claims "Offline capability -- content tools, board state, and cached files work without network. Only mutations and AI require connectivity." However, the implementation does not enforce this contract:

1. **Board view fails entirely offline.** `BoardView` makes TanStack Query calls to load board config and issues. Without network, these queries fail and the board shows an error state, even though `JiraCache` may hold perfectly valid (just slightly stale) data from 30 seconds ago. There is no stale-while-revalidate fallback.
2. **IDE read path fails offline.** `VirtualFileSystem.readFile()` checks local changes and session cache (`openFiles`), then checks the blob cache, then fetches from GitHub. The blob cache layer works offline, but only for previously-opened files. Navigating to a new file that has not been blob-cached fails with a network error. The file tree (`getTree`) also fails if the repo has not been initialized in this session.
3. **Mutations are fire-and-forget.** Dragging a card on the board triggers `doTransition()`. If the network is down, the optimistic update rolls back and the user sees an error toast. The user has to manually remember to retry. The VFS `commit()` and `createPR()` methods similarly fail immediately.
4. **No offline indicator.** The user has no visual cue that they are offline until an operation fails.

## Proposed Solution

### 1. Stale-while-revalidate for read paths
Configure TanStack Query defaults for Jira queries:
- `staleTime: 60_000` (1 minute -- matches the issue snapshot TTL).
- `gcTime: Infinity` (keep cached data in memory indefinitely during the session).
- `networkMode: 'offlineFirst'` -- return cached data immediately, revalidate in background when online.

For the VFS, persist the file tree in IndexedDB (keyed by `owner/repo/branch`) so that the explorer works offline for previously-visited repos.

### 2. Mutation queue with retry
Introduce a durable mutation queue (IndexedDB-backed) that captures failed or offline mutations and replays them when connectivity returns:

```typescript
interface QueuedMutation {
  id: string;
  type: 'jira-transition' | 'jira-update' | 'jira-comment' | 'git-commit' | 'git-pr';
  payload: unknown;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'in-flight' | 'failed' | 'completed';
}
```

Behavior:
- When `navigator.onLine` is false, mutations are queued instead of executed.
- When `navigator.onLine` transitions to true, the queue drains in FIFO order.
- Each mutation is retried up to 3 times with exponential backoff.
- The user can view the queue in a "Pending changes" panel and manually retry or discard items.
- Mutations are idempotent where possible (Jira transitions check current state before executing; commits use the expected parent SHA).

### 3. Online/offline indicator
Add a connection status indicator to the app header:
- Green dot: online, all systems responsive.
- Yellow dot: online but degraded (e.g., Jira rate-limited, GitHub slow).
- Red dot with "Offline" label: `navigator.onLine === false`.
- Badge showing count of queued mutations.

### 4. Optimistic UI persistence
The board store's `optimisticUpdates` Map currently lives only in memory. If the user refreshes while offline, optimistic state is lost. Persist `optimisticUpdates` to IndexedDB so they survive page reloads and can be reconciled when connectivity returns.

## Impact Assessment
- **User impact:** High -- delivers on the "offline capability" promise from the design doc. Critical for mobile/conference/VPN scenarios.
- **Effort estimate:** M -- TanStack Query configuration is minimal. The mutation queue is the bulk of the work, requiring careful idempotency handling and a small UI for queue visibility.
- **Risk:** Stale data can lead to conflicts. A user might transition a card offline that someone else already transitioned. Mitigated by reconciliation: when the queue drains, check current state before applying. If conflicted, surface the conflict in the pending changes panel rather than silently failing. Git commits already have built-in conflict detection (the parent SHA check).

## Competitive Analysis
- **VS Code / github.dev:** VS Code has full offline support for local files. github.dev degrades gracefully: the editor works with cached files, and a banner shows "Working offline -- some features unavailable." Commits are queued and pushed when online.
- **Figma:** Figma maintains a local operation log (CRDT-based). All edits are applied locally first and synced when online. The "Saved to Figma" / "Saving..." / "Offline" indicator is a well-known UX pattern.
- **Slack:** Slack queues messages typed while offline and sends them when connectivity returns. The compose box shows "Will send when connected." Failed messages show a retry button.
- **Google Docs:** The canonical example -- full offline editing with transparent sync. Uses a mutation queue internally.

## Technical Sketch
### New files
- `lib/offline/mutation-queue.ts` -- IndexedDB-backed mutation queue with drain/retry logic.
- `lib/offline/connection-monitor.ts` -- wraps `navigator.onLine` and `online`/`offline` events; emits state changes.
- `components/shared/ConnectionIndicator.tsx` -- header dot + queued mutations badge.
- `components/shared/PendingChanges.tsx` -- panel listing queued mutations with retry/discard.

### Modified files
- `routes/__root.tsx` or `main.tsx` -- initialize connection monitor, start queue drain listener.
- `lib/jira/queries.ts` -- set TanStack Query defaults for `staleTime`, `gcTime`, `networkMode`.
- `stores/board.ts` -- persist `optimisticUpdates` to IndexedDB; restore on init.
- `components/board/BoardView.tsx` -- use `placeholderData` or `initialData` from `JiraCache` so the board renders with stale data while offline.
- `lib/vfs/virtual-fs.ts` -- persist tree to IndexedDB in `initRepo()`; load from cache if network unavailable.
- `components/shared/Header.tsx` -- add `ConnectionIndicator` component.

### Not affected
- No WASM engine changes.
- No Service Worker protocol changes (SW already caches static assets).
- No build pipeline changes.
