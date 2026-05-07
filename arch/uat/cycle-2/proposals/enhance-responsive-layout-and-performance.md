# Proposal: Responsive Layout and Performance Optimization

## Type: enhancement

## Source
**UAT findings addressed:**
- Performance C1: Sidebar never collapses -- unusable on mobile viewports
- Performance C2: IDE three-panel layout has no responsive adaptation -- broken below ~1024px
- Performance C3: Chat context panel has no responsive handling -- overlaps on small screens
- Performance C4: No route-level code splitting -- entire app loads on first visit
- Performance U1: No list virtualization for board columns -- 100+ cards cause jank
- Performance U2: No message list virtualization for chat -- long conversations degrade
- Performance U3: Chat store creates excessive object allocations during streaming
- Performance U5: FilterBar too wide for small screens
- Performance U6: react-markdown and remark-gfm eagerly imported on board route
- Performance U7: No pagination for board issues -- single JQL fetch may timeout
- Performance P3: Vite manualChunks could include more heavy deps
- Performance P5: Chat session persistence fires on every message add, not debounced
- Performance P6: EditorTabs close button touch target too small
- Performance P7: Board card action buttons are small touch targets
- Performance P8: Theme toggle does not persist across sessions or sync between controls
- New Contributor P2: Theme toggle duplicated between Header and Settings (unsynchronized state)
- New Contributor P3: IDE right panel shows stale "Wave 3" placeholder wasting 288px
- Power User P8: Model selector shows raw model ID instead of display name

**Cycle 1 features addressed:**
- **platform-cache-eviction** (5/5 approved): The periodic eviction scheduler (Performance P2 finding on unexecuted `evictExpired()`) and SW cache size limits are addressed as part of the performance sweep
- **platform-offline-resilience** (4/5 approved): The stale-while-revalidate TanStack Query configuration for board data directly enables the responsive/offline board experience, and the online/offline indicator fits naturally in the responsive header

## Problem
The app is completely unusable on mobile (sidebar consumes 60% of a 375px viewport, IDE panels require 752px before any content) and degrades significantly on tablets. The initial bundle includes all route components synchronously (~100KB+ of unnecessary code). Board columns render all cards without virtualization (2000+ DOM nodes per column at 100 cards), chat re-parses all markdown on every stream chunk, and the streaming store creates O(n) allocations per character. Cache eviction is never triggered, allowing IndexedDB to grow unboundedly.

## Solution

### 1. Responsive sidebar
- In `Sidebar.tsx`, add `hidden md:flex` to hide the sidebar on mobile. Add a hamburger menu button in `Header.tsx` (visible only `md:hidden`) that toggles sidebar visibility via a Zustand `useLayoutStore` atom.
- Create `src/stores/layout.ts` with `sidebarOpen: boolean`, `sidebarCollapsed: boolean`, `toggleSidebar()`. Replace the brittle DOM-based sidebar toggle in `default-commands.ts` with `useLayoutStore.getState().toggleSidebar()`.
- Consolidate theme state into `useLayoutStore` as well: `isDark: boolean`, `toggleTheme()`, initialized from `localStorage.getItem('aegis-theme')`. Replace the independent theme state in Header and Settings with this shared store. Fix `default-commands.ts` theme toggle to use the store instead of DOM manipulation.

### 2. Responsive IDE layout
- In `IDELayout.tsx`, hide the file explorer (`hidden lg:block`) and the right panel (`hidden xl:block`) on smaller breakpoints. Add toggle buttons in the IDE header to show/hide panels on demand.
- Remove the stale "AI chat will be available in Wave 3" right panel. Either hide it entirely or replace it with a collapsible panel that links to the existing chat route for the same issue.

### 3. Responsive chat layout
- In the chat route, make the context panel `hidden lg:block` and add a toggle button (info icon) to show/hide it as a slide-over sheet on mobile.
- On the FilterBar, add `flex-wrap` so filters wrap to a second line on narrow screens. Consider collapsing into a single "Filters" dropdown button below `md` breakpoint.

### 4. Route-level code splitting
- In `routeTree.gen.ts` (or the route definitions), wrap route component imports with TanStack Router's `lazyRouteComponent()`:
  ```typescript
  const BoardRoute = lazyRouteComponent(() => import('./routes/board.$boardId'))
  const ChatRoute = lazyRouteComponent(() => import('./routes/issue.$issueKey.chat'))
  const IDERoute = lazyRouteComponent(() => import('./routes/issue.$issueKey.ide'))
  ```
- Lazy-import `ReactMarkdown` and `remarkGfm` in `CardDetail.tsx` using `React.lazy()` so the markdown ecosystem (~40KB) is not in the board route's initial chunk.
- Add additional `manualChunks` in `vite.config.ts` for `react-markdown`, `@hello-pangea/dnd`, and Radix UI packages.

### 5. Board virtualization and pagination
- Add `@tanstack/react-virtual` for board column virtualization. In `Column.tsx`, replace `.map()` with a virtual list that renders only visible cards (~15 at a time instead of 100+).
- In `src/lib/jira/queries.ts`, implement cursor-based pagination: fetch 50 issues per page, use `startAt` parameter, render incrementally. Show a "Load more" button or infinite scroll trigger at the bottom of each column.

### 6. Chat streaming performance
- In `stores/chat.ts` `appendStreamChunk`: instead of spreading the entire sessions Map, messages array, and message object on every chunk, use a mutable ref pattern or Zustand's `immer` middleware for in-place updates. Only create a new reference when streaming ends (on `setStreaming(false)`).
- Debounce `persistSession()` calls: persist at most once every 5 seconds during streaming, plus once when streaming ends.
- In `MessageList.tsx`, add `@tanstack/react-virtual` for message virtualization in long conversations.

### 7. Cache eviction scheduler
- Create `src/lib/cache/eviction-scheduler.ts` that calls `evictExpired()` on all CacheStore instances on app startup and every 15 minutes.
- Add a size limit to the SW `aegis-static-v1` cache (100 entries, LRU eviction).

### 8. Touch target and display fixes
- Increase EditorTabs close button to `min-w-[28px] min-h-[28px]` with larger padding.
- Increase card action buttons from `h-7` to `h-9` and add `@media (pointer: coarse)` overrides for `min-h-[44px]`.
- In `ChatView.tsx` model selector, look up the model's `name` property from the provider's `models` array instead of displaying the raw model ID.

## Effort: L

## Files affected
- `src/stores/layout.ts` (new -- sidebar, theme, layout state)
- `src/lib/cache/eviction-scheduler.ts` (new -- periodic cache cleanup)
- `src/components/shared/Sidebar.tsx` (responsive hiding, Zustand-based toggle)
- `src/components/shared/Header.tsx` (hamburger button, theme from shared store, connection indicator)
- `src/routes/__root.tsx` (responsive flex layout)
- `src/routes/settings.tsx` (theme from shared store)
- `src/lib/commands/default-commands.ts` (use layout store for sidebar/theme toggle)
- `src/components/ide/IDELayout.tsx` (responsive panels, remove Wave 3 placeholder)
- `src/routes/issue.$issueKey.chat.tsx` (responsive context panel)
- `src/components/board/FilterBar.tsx` (flex-wrap, responsive collapse)
- `src/components/board/Column.tsx` (virtual list)
- `src/components/chat/MessageList.tsx` (virtual list)
- `src/stores/chat.ts` (mutable streaming, debounced persistence)
- `src/lib/jira/queries.ts` (pagination, stale-while-revalidate config)
- `src/components/board/CardDetail.tsx` (lazy-import ReactMarkdown)
- `vite.config.ts` (additional manualChunks)
- `src/main.tsx` (initialize eviction scheduler)
- `src/components/ide/EditorTabs.tsx` (larger touch targets)
- `src/components/board/Card.tsx` (larger touch targets)
- `src/components/chat/ChatView.tsx` (model display name)
- `public/sw.js` (cache size limit)

## Test plan
- Responsive testing at 375px (phone), 768px (tablet portrait), 1024px (tablet landscape), 1440px (desktop):
  - Verify sidebar is hidden on mobile with a hamburger toggle
  - Verify IDE shows only the editor on mobile, file explorer appears at lg, right panel at xl
  - Verify chat context panel is hidden on mobile with a toggle button
  - Verify FilterBar wraps gracefully on narrow screens
- Performance benchmark: load a board with 100+ cards, measure initial render time and scroll FPS. Target: <200ms render, 60fps scroll with virtualization.
- Bundle analysis: run `vite build` and verify board, chat, and IDE routes are in separate chunks. Verify react-markdown is not in the initial bundle.
- Verify theme toggle syncs between Header, Settings, and command palette (toggle in one, check others reflect the change)
- Verify sidebar toggle via command palette uses React state, not DOM manipulation
- Verify chat streaming does not create excessive GC pressure: profile with Chrome DevTools Memory tab during a long streaming response
- Verify `evictExpired()` runs on app startup (add a console.debug log, check it fires)
- Verify model selector shows friendly name (e.g., "Claude Sonnet 4.6") instead of raw ID
- Touch target audit: verify all interactive elements meet 28px minimum (44px on touch devices)
