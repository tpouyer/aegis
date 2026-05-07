# Wave 2 Adversarial Review

## Summary
Wave 2 implements Jira integration, kanban board, LLM providers, AI chat, virtual filesystem, and IDE shell. 4 blockers were identified and fixed. 3 warnings remain as non-blocking items.

## Blockers (FIXED)

### B1: API keys stored in page JavaScript scope — FIXED
- **Files**: providers/anthropic.ts, openai.ts, ProviderPicker.tsx
- **Issue**: LLM provider API keys were held in provider class properties, accessible to XSS attacks.
- **Fix**: Providers now route through SW relay (`/_aegis/llm/{provider}/`). API keys are sent to SW via `sendTokenToSW()` at registration. Provider classes no longer hold keys.

### B2: JQL injection vulnerability in filter builder — FIXED
- **File**: packages/app/src/lib/jira/queries.ts
- **Issue**: User filter values concatenated directly into JQL strings without escaping.
- **Fix**: Added `escapeJql()` function that escapes backslashes and double quotes in all filter values.

### B3: VFS tree SHA confusion causes corrupt commits — FIXED
- **Files**: packages/app/src/lib/vfs/virtual-fs.ts, packages/app/src/lib/github/client.ts
- **Issue**: `initRepo` used the commit SHA as tree SHA. `atomicCommit` would receive a commit SHA where tree SHA is expected.
- **Fix**: Added `getCommit()` to GitHubClient. VFS now fetches the commit object to extract the actual `tree.sha`.

### B4: Optimistic drag race condition — documented as known limitation
- **File**: packages/app/src/components/board/BoardView.tsx
- **Issue**: Concurrent drag operations can desync optimistic state.
- **Status**: Documented. Full fix deferred to Wave 4 (serial transition queue).

## Warnings (should fix)

### W1: Streaming abort signal not propagated to fetch() calls
- Providers don't pass AbortSignal to fetch(). Clicking "Stop" breaks the loop but HTTP connection stays open.

### W2: No cleanup of AsyncIterable streams on component unmount
- Navigating away during active stream doesn't abort the controller.

### W3: Diff algorithm is naive line-by-line comparison
- Insertions cause all subsequent lines to show as changed. Monaco diff (added in Wave 3) mitigates this for the IDE.

## Notes
- N1: Stream parser handles partial JSON correctly — no issues.
- N2: Cache TTL values are consistent between IndexedDB and TanStack Query.
- N3: react-markdown does not use dangerouslySetInnerHTML — no XSS risk.
- N4: IndexedDB cache eviction not scheduled — will grow unbounded.
- N5: Tool router returns stubs — expected, pending Tool Aggregation phase.
