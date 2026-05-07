# UAT: Mobile & Performance Tester -- Cycle 2

**Tester persona**: Developer on a slow connection with a small viewport
**Date**: 2026-05-07
**Scope**: Responsive layout, touch targets, bundle size, lazy loading boundaries, large data sets (100+ board cards, long chat histories, big file trees)
**Focus areas**: Layout breakpoints, scroll performance, initial load time, memory growth, service worker caching effectiveness

---

## Critical Issues (blocks user journey)

### C1: No list virtualization for board columns -- 100+ cards will cause severe jank
- **Journey step**: Opening a board with 100+ issues distributed across columns
- **Expected**: Smooth scrolling through large columns; only visible cards are rendered in the DOM
- **Actual**: Every card is rendered eagerly via `issues.map()` inside `Column.tsx:46-51`. No windowing/virtualization library is installed (no react-window, react-virtuoso, or @tanstack/virtual in `package.json`). Each `IssueCard` includes a `Draggable` wrapper, two `Link` components, multiple `Badge` components, and an `img` element -- rendering 100+ of these simultaneously will produce hundreds of DOM nodes per column.
- **Impact**: With 4-5 columns and 100+ total cards, the DOM will contain 500-1000+ card-related nodes. Drag-and-drop performance will degrade because `@hello-pangea/dnd` re-renders the entire droppable list on drag. Users on lower-powered devices or mobile will experience frame drops and sluggish scrolling.
- **File**: `packages/app/src/components/board/Column.tsx:46-51`
- **Fix**: Add `@tanstack/react-virtual` or `react-virtuoso` to virtualize the card list inside each `Column`. Limit rendered cards to viewport + buffer. This also requires careful integration with `@hello-pangea/dnd` which expects all Draggable children in the DOM.

### C2: No list virtualization for chat message history -- memory grows unbounded
- **Journey step**: Long AI chat session with 200+ messages (common in extended coding sessions)
- **Expected**: Smooth scrolling; old messages outside viewport are not in the DOM
- **Actual**: `MessageList.tsx:46-48` renders all messages via `messages.map()` without any virtualization. Each assistant message includes full markdown rendering (`ReactMarkdown` + `remarkGfm`), which parses and produces a React tree for every message on every render. Code blocks include a `Button` component for copy. Tool call/result pairs add additional nested components.
- **Impact**: After 100+ messages with code blocks and tool results, the DOM will contain thousands of nodes. Markdown re-parsing on each render cycle (triggered by streaming chunks via `appendStreamChunk`) will cause increasing frame drops. The `useEffect` auto-scroll at line 29-31 fires on every content update, compounding the problem.
- **File**: `packages/app/src/components/chat/MessageList.tsx:43-58`
- **Fix**: Virtualize the message list. Memoize individual `MessageBubble` components. Consider `React.memo` for completed (non-streaming) messages to avoid re-parsing markdown.

### C3: Sidebar is always visible with fixed w-56 (224px) -- steals ~60% of a 375px mobile screen
- **Journey step**: Any page navigation on a mobile viewport (375px wide)
- **Expected**: Sidebar collapses to icons or a hamburger menu on small screens
- **Actual**: `Sidebar.tsx:6` renders `<aside className="flex h-full w-56 flex-col ...">` with no responsive breakpoints. The sidebar has zero `sm:`, `md:`, or `lg:` responsive classes. Combined with the `Header` (h-14 = 56px), usable content area on a 375px-wide screen is only ~151px wide, which is unusable for the board, chat, or IDE.
- **Impact**: The app is functionally broken on mobile devices. Board columns (w-72 = 288px each) will overflow. The chat context panel (w-72) plus the chat area cannot fit. The IDE layout (w-60 left panel + w-72 right panel = 240px + 288px) is completely impossible.
- **File**: `packages/app/src/components/shared/Sidebar.tsx:6`
- **Fix**: Add responsive classes: hide sidebar below `md:` breakpoint, add a hamburger toggle in the Header, or convert to an icon-only rail on small screens. Pattern: `hidden md:flex` on the sidebar, plus a `<button className="md:hidden">` hamburger in the Header.

### C4: No route-level code splitting -- all routes loaded eagerly in the initial bundle
- **Journey step**: First visit to the landing page on a slow 3G connection
- **Expected**: Only the landing page code is loaded initially; board, chat, IDE, and settings code are loaded on demand
- **Actual**: The `routeTree.gen.ts` (lines 11-16) uses static imports for ALL route modules -- every route component and its dependencies are bundled into the initial chunk. The `vite.config.ts` has `manualChunks` for vendor libraries (react, router, query) but no route-level splitting. TanStack Router supports `lazyRouteComponent()` for code splitting but it is not used here.
- **Impact**: The initial bundle includes the full board view (with its DnD context, Jira client, and all board components), the chat view (with ReactMarkdown, remark-gfm, rehype, and all chat components), and the IDE route (which imports MonacoEditor, VirtualFileSystem, GitHub client, etc.). While Monaco itself is lazy-loaded via `React.lazy()`, the IDE route's wrapper code and VFS are not. This bloats the initial load significantly on slow connections. Estimated unnecessary code in initial bundle: ~100KB+ of route-specific components and transitive dependencies.
- **File**: `packages/app/src/routeTree.gen.ts:11-16`; `packages/app/vite.config.ts:22-30`
- **Fix**: Use TanStack Router's `lazyRouteComponent()` or `lazy()` route option to defer loading of the board, chat, and IDE route modules. These are heavy routes that most users won't visit immediately.

---

## UX Issues

### U1: Chat context panel has no responsive behavior -- hidden toggle button and fixed width
- **Journey step**: Opening AI chat on a tablet or small laptop (768px-1024px viewport)
- **Expected**: Context panel collapses or becomes a drawer on smaller screens
- **Actual**: `issue.$issueKey.chat.tsx:60` renders `IssueContextPanel` at a fixed `w-72` (288px). The toggle button is positioned with `absolute right-0 top-1/2`, which overlaps the context panel edge. On a 768px screen, the chat area gets only ~480px minus sidebar (224px) = ~256px, which is too narrow for comfortable reading. The panel has no responsive breakpoints -- it is either fully visible or toggled off.
- **Impact**: On tablets, the chat area is cramped. Users must manually toggle the panel, but the tiny toggle button (w-6 h-8) may be hard to discover.
- **File**: `packages/app/src/routes/issue.$issueKey.chat.tsx:187-199`

### U2: IDE layout has three fixed-width panels -- completely breaks on screens under 1200px
- **Journey step**: Opening the IDE on any screen narrower than ~1200px
- **Expected**: Panels collapse, stack, or become toggleable
- **Actual**: `IDELayout.tsx` uses three fixed panels: left file explorer (`w-60` = 240px, line 197), right AI assistant placeholder (`w-72` = 288px, line 254), and the editor fills the remaining space. On a 1024px screen minus sidebar (224px), only 800px remains. After subtracting left (240px) and right (288px) panels, the editor gets only 272px. No responsive classes are used on any panel.
- **Impact**: The IDE is very cramped on screens under ~1400px and approaching unusable under ~1200px. This includes most laptops.
- **File**: `packages/app/src/components/ide/IDELayout.tsx:197,254`

### U3: Board filter bar overflows horizontally on narrow screens
- **Journey step**: Viewing the board filter bar on a screen under 768px
- **Expected**: Filter controls wrap or collapse into a single dropdown
- **Actual**: `FilterBar.tsx:57` renders all filter elements in a single `flex` row with `gap-2`. Five filter dropdowns plus the search input plus the clear button are laid out horizontally. The text search input is `w-48` (192px), plus 4 dropdown buttons (~80px each), plus filter icon and clear button = ~560px minimum. On a 375px screen (minus 224px sidebar = 151px usable), these will overflow and be inaccessible. No `flex-wrap` or responsive collapsing is applied.
- **Impact**: Filters cannot be used on mobile or narrow tablet viewports.
- **File**: `packages/app/src/components/board/FilterBar.tsx:57`

### U4: Board columns have fixed w-72 width with no responsive adaptation
- **Journey step**: Viewing the kanban board on a mobile device
- **Expected**: Columns stack vertically or adopt a card-stack view on narrow screens
- **Actual**: `Column.tsx:24` uses `w-72 flex-shrink-0`, making each column exactly 288px wide and non-shrinkable. The parent container in `BoardView.tsx:401` uses `overflow-x-auto`, so columns scroll horizontally. On a 375px screen minus sidebar, the user can see at most half of one column.
- **Impact**: Mobile users must constantly scroll horizontally to see different columns. This is a poor mobile experience for a kanban board. Drag-and-drop between columns requires scrolling mid-drag, which `@hello-pangea/dnd` does not handle well on touch.
- **File**: `packages/app/src/components/board/Column.tsx:24`

### U5: Touch targets are too small for mobile use across multiple components
- **Journey step**: Tapping any interactive element on a mobile device
- **Expected**: Touch targets should be at least 44x44px per Apple HIG / Material Design guidelines
- **Actual**: Multiple interactive elements are below the 44px minimum:
  - Card action buttons: `h-7` (28px) in `Card.tsx:102-103`
  - Filter dropdown buttons: `h-8` (32px) in `FilterBar.tsx:160`
  - File explorer items: `py-0.5` (2px top/bottom padding) with text-sm in `FileExplorer.tsx:107-108`, approximately 24px total height
  - Editor tab close buttons: `p-0.5` (2px padding) around a 12x12 icon in `EditorTabs.tsx:48`
  - Header theme toggle: `p-2` (8px padding) around a 20x20 icon = ~36x36px in `Header.tsx:31`
  - Source control file buttons: `py-1` (4px top/bottom) in `SourceControl.tsx:189-196`
  - Source control commit/PR buttons: `h-7` (28px) in `SourceControl.tsx:218-235`
- **Impact**: Users on touch devices will frequently miss-tap targets, leading to frustration. The file explorer tree items are especially problematic.
- **File**: Multiple files as listed above

### U6: No pagination or infinite scroll for board issues -- maxResults capped at 100
- **Journey step**: Working with a board that has 200+ issues
- **Expected**: Load more issues as user scrolls, or provide pagination controls
- **Actual**: `JiraClient.getIssuesForBoard()` defaults to `maxResults = 100` (line 119). The `useIssues` hook calls this once and treats the result as complete. The `JiraSearchResponse` type includes `total` and `startAt` fields (types.ts:207-211) indicating the API supports pagination, but no pagination logic exists in the query hooks or UI. There is no "Load More" button, page selector, or infinite scroll.
- **Impact**: Boards with more than 100 issues will silently truncate. Users will not know that issues are missing.
- **File**: `packages/app/src/lib/jira/client.ts:119`; `packages/app/src/lib/jira/queries.ts:91-106`

### U7: `react-markdown` and `remark-gfm` are eagerly imported on the board route
- **Journey step**: Navigating to the board page (before opening any card detail)
- **Expected**: Markdown rendering libraries only load when viewing card details or chat
- **Actual**: `CardDetail.tsx:9-10` imports `ReactMarkdown` and `remarkGfm` at the top level. Since `CardDetail` is imported by `BoardView.tsx:30`, and `BoardView` is imported by the board route, these libraries are bundled into the initial board route chunk. The `react-markdown` + `remark-gfm` + `unified` ecosystem adds ~40KB gzipped.
- **Impact**: Users loading the board page pay the cost of markdown parsing libraries even before opening any card detail panel.
- **File**: `packages/app/src/components/board/CardDetail.tsx:9-10`

---

## Polish Items

### P1: Chat message streaming creates excessive re-renders and allocations
- **Journey step**: Receiving a long AI response with streaming
- **Expected**: Efficient incremental rendering with minimal allocations
- **Actual**: `appendStreamChunk` in `chat.ts:117-135` creates a new `Map`, spreads the entire sessions Map, spreads the messages array, and spreads the last message object on every single stream chunk. Streaming typically delivers tokens every 50-100ms, producing 10-20 state updates per second. Each triggers a full re-render of the `MessageList`, which re-renders all `ReactMarkdown` instances for all messages. No debouncing, batching, or memoization is applied.
- **File**: `packages/app/src/stores/chat.ts:117-135`
- **Suggestion**: Batch streaming chunks with a small buffer (e.g., 100ms debounce via `requestAnimationFrame`) or use a ref for streaming content and only update state periodically. Wrap `MessageBubble` in `React.memo` for completed messages.

### P2: No resource hints in index.html for known external origins
- **Journey step**: Initial page load
- **Expected**: `<link rel="preconnect">` for known API origins to reduce connection setup latency
- **Actual**: `index.html` contains only the viewport meta tag, title, root div, and script tag. No preconnect, prefetch, preload, or modulepreload hints.
- **File**: `packages/app/index.html`
- **Suggestion**: Add `<link rel="preconnect" href="https://api.github.com">` and `<link rel="preconnect" href="https://api.atlassian.com">` to reduce latency on first API calls.

### P3: Service worker precache list is minimal -- offline experience is fragile
- **Journey step**: Returning to the app after initial visit without network
- **Expected**: All critical app shell assets are precached for offline use
- **Actual**: `sw.js:34-37` only precaches `["/", "/index.html"]`. CSS, JS bundles, fonts, and the WASM binary are not precached. They will be cached opportunistically on first use via the `cacheFirst` strategy, but a user who visits only the landing page and returns offline will not have the board or chat route cached.
- **File**: `packages/app/public/sw.js:34-37`
- **Suggestion**: Integrate with Vite's build output to generate a precache manifest (e.g., via `workbox-build` or `vite-plugin-pwa`). Include hashed asset filenames for cache-busting.

### P4: Monaco models are disposed and recreated on every tab switch
- **Journey step**: Opening many files in the IDE (10+), rapidly switching between tabs
- **Expected**: Monaco models are reused when switching back to a previously opened file
- **Actual**: `MonacoEditor.tsx:109-120` disposes the model on unmount via `useEffect` cleanup. When switching tabs, the component unmounts and remounts, creating a new model each time. While disposal prevents memory leaks, it means no model caching -- the editor re-parses the file on every tab switch, which is wasteful for large files and causes a visible flash.
- **File**: `packages/app/src/components/ide/MonacoEditor.tsx:109-120`
- **Suggestion**: Keep models alive in a global Map keyed by `modelUri` and only dispose when the tab is explicitly closed (not on component unmount from tab switching).

### P5: FilterBar text search is not debounced
- **Journey step**: Typing quickly in the board filter search box
- **Expected**: Filtering triggers after a short debounce (200-300ms)
- **Actual**: `FilterBar.tsx:66-68` calls `setFilter('text', ...)` on every `onChange` event, which updates the Zustand store synchronously. While the text filter is applied client-side (not via JQL), it still triggers a full re-render of all columns and cards on every keystroke.
- **File**: `packages/app/src/components/board/FilterBar.tsx:66-68`
- **Suggestion**: Add a 200-300ms debounce on the text filter input using a local state + `useEffect` or a `useDeferredValue` hook.

### P6: FileExplorer builds the full nested tree on every render for large repos
- **Journey step**: Browsing a repository with 1000+ files in the IDE file explorer
- **Expected**: Tree construction is lazy -- only expanded directories build children
- **Actual**: `FileExplorer.tsx:29-66` builds the full nested tree from the flat entry list via `useMemo` keyed on `tree`. While collapsed directories skip rendering children in JSX, `buildTree()` still processes and sorts all entries (O(n log n)). For a repo with 5000+ entries, tree construction can take 50-100ms.
- **File**: `packages/app/src/components/ide/FileExplorer.tsx:29-66`
- **Suggestion**: Consider lazy tree construction -- only build child nodes when a directory is expanded for the first time. Cache built subtrees.

### P7: VFS stores all opened file contents in memory with no eviction
- **Journey step**: Browsing through 50+ files in a large repo in the IDE
- **Expected**: File contents evicted from memory when no longer needed
- **Actual**: `VirtualFileSystem.ts` stores all opened file contents in `state.openFiles` (a Map at line 65) with no eviction. The `readFile` method (line 108-147) adds entries but never removes them. After browsing 50 large files (~100KB each), 5MB+ of memory is consumed unnecessarily.
- **File**: `packages/app/src/lib/vfs/virtual-fs.ts:108-147`
- **Suggestion**: Implement an LRU cache for `openFiles` with a configurable limit (e.g., 30-50 files). Files can always be re-fetched from the content-addressed blob cache in IndexedDB.

### P8: Theme toggle in Header is not synchronized with Settings page
- **Journey step**: Toggling theme from the header, then visiting Settings
- **Expected**: Both theme controls reflect the same state
- **Actual**: `Header.tsx:4-16` manages its own `isDark` state independently from `useTheme()` in `settings.tsx:50-69`. Both read from `document.documentElement.classList` and write to `localStorage`, but they do not share reactive state. Toggling in the Header does not update the Settings toggle (and vice versa) until the component remounts.
- **File**: `packages/app/src/components/shared/Header.tsx:4-16`; `packages/app/src/routes/settings.tsx:50-69`
- **Suggestion**: Extract theme state into a Zustand store or React context shared between Header and Settings.

### P9: Vite manualChunks could split more heavy dependencies for better caching
- **Journey step**: Deploying an app update
- **Expected**: Unchanged vendor code remains cached; only app code is re-downloaded
- **Actual**: `vite.config.ts:24-28` splits only `react`, `react-dom`, `@tanstack/react-router`, and `@tanstack/react-query`. Other heavy dependencies like `react-markdown` + `remark-gfm` (~40KB), `@hello-pangea/dnd` (~30KB), `@radix-ui/*` (~25KB), and `lucide-react` are bundled with app code.
- **File**: `packages/app/vite.config.ts:22-30`
- **Suggestion**: Add manual chunks for markdown, dnd, and radix dependencies to improve cache granularity across deployments.

### P10: IndexedDB expired entries accumulate -- eviction is never triggered automatically
- **Journey step**: Using the app over several days
- **Expected**: Expired cache entries are cleaned up periodically
- **Actual**: `CacheStore.evictExpired()` exists (`indexeddb.ts:218-247`) but is never called on a schedule. Expired entries remain in storage until a `get()` check returns null for them, but the storage space is never reclaimed proactively.
- **File**: `packages/app/src/lib/cache/indexeddb.ts:218-247`
- **Suggestion**: Call `evictExpired()` on app startup or on a 1-hour interval to clean up stale data.

### P11: Chat session persistence fires on every message addition during conversation
- **Journey step**: Active chat with rapid message exchange
- **Expected**: IndexedDB writes are batched or debounced
- **Actual**: `chat.ts:114` calls `persistSession()` after every `addMessage()`, meaning 2 IndexedDB writes per user message (user message + empty assistant placeholder). During streaming completion, `setStreaming(false)` triggers another persist (line 147). This creates 3+ IndexedDB writes per exchange.
- **File**: `packages/app/src/stores/chat.ts:114,147`
- **Suggestion**: Debounce persistence to every 2-5 seconds, or persist only on streaming completion and before page unload.

### P12: Service worker cache has no size limit or LRU eviction
- **Journey step**: Using the app extensively over weeks
- **Expected**: Cache size is bounded to prevent excessive storage use
- **Actual**: `sw.js:249-260` (`cacheFirst`) stores every static asset response without limit. The `aegis-static-v1` cache can grow unbounded.
- **File**: `packages/app/public/sw.js:249-260`
- **Suggestion**: Add a cache size limit (e.g., 100 entries) with LRU eviction, or use `navigator.storage.estimate()` to monitor usage.

---

## Positive Observations

- **Monaco lazy loading is well-implemented**: The editor (`MonacoEditor.tsx:18-19`), diff view (`MonacoDiffView.tsx:17-18`), and apply block (`ApplyBlock.tsx:19-20`) all use `React.lazy()` with `Suspense` fallbacks and an `ErrorCatcher` boundary. This keeps the ~3MB Monaco bundle out of the initial load. The `EditorPlaceholder` fallback provides a usable degraded experience if Monaco fails to load.
- **Service Worker architecture is sound**: The SW correctly separates static asset caching (cache-first), API proxying (network-first for dynamic), LLM relay routing with provider-specific auth header injection, and secure token storage in SW memory scope (immune to XSS). Cache versioning with cleanup on activate prevents stale cache accumulation.
- **Resilient fetch is thorough**: `resilient-fetch.ts` implements exponential backoff with jitter, `Retry-After` header parsing (both integer seconds and HTTP-date formats), GET deduplication via an in-flight promise Map, abort signal integration, and configurable retry status codes. This properly handles Jira's 100 req/min rate limit.
- **IndexedDB caching is well-structured**: The two-layer cache (TanStack Query in-memory + IndexedDB with TTL) provides good offline resilience. TTL tiers are appropriate (60s for issue snapshots, 1h for board configs, 24h for workflow metadata). The `JiraCache` wrapper provides type-safe access with proper key namespacing.
- **Content-addressed file caching**: The VFS caches blobs by SHA (`virtual-fs.ts:130-131`), meaning file content never goes stale -- a very efficient caching strategy that avoids unnecessary re-fetches even across sessions.
- **Optimistic updates with rollback**: The board store's optimistic update pattern (`BoardView.tsx:147-150`) with proper rollback on failure (`BoardView.tsx:166-168`) and a `TransitionModal` for field-required transitions ensures the UI feels responsive even on slow networks.
- **Keyboard shortcuts system**: The scoped shortcut system (global, board, chat, IDE scopes) with the command palette (`Cmd+K`) provides efficient keyboard-driven navigation. Scope isolation prevents shortcut conflicts between views.
- **Error boundaries are properly placed**: The root-level `ErrorBoundary` prevents full app crashes, and the Monaco-specific `ErrorCatcher` class component handles editor load failures gracefully.
- **Vite vendor chunks**: Separating `react-vendor`, `router`, and `query` into separate chunks enables parallel loading and better cache granularity for common dependencies.
- **Dark mode support**: Full dark/light theme implemented via CSS custom properties in `app.css` with proper contrast ratios and consistent application throughout all components.
- **Viewport meta tag**: Correctly set in `index.html` with `width=device-width, initial-scale=1.0`.
- **DragDropContext is properly scoped**: The `DragDropContext` wraps only the board columns area (`BoardView.tsx:397-412`), not the entire page, minimizing DnD overhead on non-board routes.
- **Loading states are present**: Board (`BoardView.tsx:303`), IDE (`issue.$issueKey.ide.tsx:136`), and chat (`ChatView.tsx:231-233`) all show meaningful loading indicators during data fetching, preventing blank screens.

---

## Summary

The app has a well-architected data layer with thoughtful caching, resilient networking, and proper separation of concerns. However, the UI layer has significant gaps for mobile support and performance at scale:

1. **Mobile is effectively unsupported** -- the fixed 224px sidebar, fixed panel widths, and complete absence of responsive breakpoints (`sm:`, `md:`, `lg:` classes are used only in Shadcn UI primitives, never in app components) make the app unusable below ~1200px viewport width.
2. **List virtualization is absent everywhere** -- both the board (100+ cards) and chat (200+ messages) render all items eagerly, which will degrade significantly with real-world data volumes.
3. **Route-level code splitting is missing** -- all route components are eagerly loaded via static imports in the generated route tree, inflating the initial bundle with board, chat, and IDE code that the landing page does not need.
4. **Touch targets are consistently too small** -- card action buttons (28px), file explorer items (~24px), tab close buttons (~16px), and filter buttons (32px) are all well below the 44px minimum for reliable touch interaction.

**Priority ordering for fixes**:
1. C3 (responsive sidebar) + C4 (route code splitting) -- foundational, affects all users
2. C1 + C2 (virtualization) -- affects users with real data volumes
3. U5 (touch targets) + U2 (IDE responsive) -- affects tablet/mobile users
4. P1 (streaming batching) + P5 (filter debounce) -- polish for perceived performance
