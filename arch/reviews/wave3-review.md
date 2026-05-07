# Wave 3 Adversarial Review

## Summary
Wave 3 implements toast notifications, board interactivity, AI chat completion, and IDE editor + git. 4 blockers + 1 warning were identified and fixed.

## Blockers (FIXED)

### B1: LLM API keys not injected by SW relay — FIXED
- **Issue**: SW relay set `authProvider = null` for Anthropic/OpenAI, never injecting keys. CustomProvider still held API key in page JS.
- **Fix**: SW now uses provider-specific token keys and injects `x-api-key` (Anthropic) or `Authorization: Bearer` (OpenAI/custom). CustomProvider routes through SW relay.

### B2: Abort signal not propagated to fetch() — FIXED
- **Issue**: Clicking "Stop" broke the AsyncIterable loop but HTTP connection stayed open.
- **Fix**: Added `signal?: AbortSignal` to `ChatParams`, passed through to `fetch()` in Anthropic and OpenAI providers.

### B3: Monaco editor models never disposed — FIXED
- **Issue**: Monaco models persisted after tab close/unmount, causing memory leaks.
- **Fix**: Added `useEffect` cleanup that calls `model.dispose()` on unmount.

### B4: Toast setTimeout zombie timeouts — FIXED
- **Issue**: Timeout IDs not tracked, couldn't be cleared on manual dismiss or navigation.
- **Fix**: Track timeout IDs in a Map, clear on `removeToast()` and `clearToasts()`.

## Warnings (FIXED)

### W3: VFS commit reintroduced tree SHA bug — FIXED
- **Issue**: After commit, `getTree()` called with commit SHA instead of tree SHA.
- **Fix**: Fetch commit object post-commit to get correct `tree.sha`.

## Remaining items (deferred)
- W1: TransitionModal error state can orphan optimistic update — edge case, deferred
- W2: IndexedDB cache eviction not scheduled — deferred to production hardening
- W4: Chat export timezone inconsistency — minor UX, deferred
