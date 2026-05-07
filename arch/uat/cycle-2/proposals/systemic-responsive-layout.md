# Proposal: Responsive Layout System -- Collapsible Sidebar, Adaptive Panels, and Route-Level Code Splitting

## Type: systemic

## Source
- **performance C1**: Sidebar never collapses -- unusable on mobile viewports (fixed `w-56`, no breakpoints)
- **performance C2**: IDE three-panel layout completely broken below ~1024px (752px consumed by fixed panels)
- **performance C3**: Chat context panel has no responsive handling -- overlaps on small screens (512px consumed before chat area)
- **performance C4**: No route-level code splitting -- entire app loads on first visit
- **performance U5**: FilterBar 5 dropdown triggers too wide for small screens (560px minimum)
- **performance U6**: `react-markdown` and `remark-gfm` eagerly imported on board route
- **accessibility C2**: Drag-and-drop has no keyboard alternative (partially addressed by responsive -- mobile users need non-DnD transitions)
- **new-contributor U4**: Empty states use `window.location.href` instead of client-side navigation (full page reload loses state)
- **power-user P4**: IDE file explorer has no keyboard navigation (related: panel needs to be toggleable)

## Problem
Every layout in the app uses hardcoded pixel widths with zero responsive breakpoints. The root sidebar is always 224px, the IDE consumes 752px+ in fixed panels, and the chat context panel takes 288px. On any viewport under ~1024px, most features are unusable. Combined with no route-level code splitting, first-load performance suffers on all devices. This is not a set of isolated CSS issues -- it requires a layout architecture change at the root level.

## Solution
Introduce a responsive layout system with three coordinated changes:

### 1. Collapsible sidebar with React state management
- **`src/components/shared/Sidebar.tsx`**: Add responsive classes: `hidden md:flex` on the `<aside>` element so the sidebar hides on mobile by default. Add a `collapsed` state managed via a new `useLayoutStore` Zustand store.
- **`src/routes/__root.tsx`**: Add a hamburger toggle button (`<button>`) inside `<Header>` that is only visible on mobile (`md:hidden`). Clicking it toggles the sidebar via the layout store. On `md+` screens, the sidebar is always visible.
- **New `src/stores/layout.ts`**: Zustand store with `{ sidebarOpen: boolean, toggleSidebar: () => void }`. This replaces the brittle DOM manipulation in `src/lib/commands/default-commands.ts:87-89` (which does `querySelector('aside')?.classList.toggle('hidden')`). The command palette "Toggle Sidebar" command should call `layoutStore.toggleSidebar()`.
- Persist sidebar preference in `localStorage`.

### 2. Adaptive panel layouts per route
- **`src/components/ide/IDELayout.tsx`**: 
  - File explorer: `hidden lg:block w-60` -- hidden on screens < 1024px, with a toggle button visible on smaller screens.
  - Right panel (AI chat placeholder): `hidden xl:block w-72` -- hidden below 1280px. Since this panel currently shows "available in Wave 3," hiding it reclaims space with no loss.
  - Add toggle buttons for each panel that show/hide via local state.
- **`src/routes/issue.$issueKey.chat.tsx`**: 
  - Context panel: `hidden lg:block w-72` -- hidden below 1024px. Add a slide-out Sheet (Radix) that opens on mobile when user taps an info icon.
  - The toggle button at line 188 should control the Sheet on mobile and the panel on desktop.
- **`src/components/board/FilterBar.tsx`**: 
  - Add `flex-wrap` to the filter container. On narrow screens, dropdowns wrap to a second row.
  - Alternative: collapse filters into a single "Filters" dropdown button on screens < 768px.

### 3. Route-level code splitting
- **`src/routeTree.gen.ts`** (or route definitions): Use TanStack Router's `lazyRouteComponent()` for the board, chat, and IDE routes. Only the landing page and settings load synchronously.
- **`src/components/board/CardDetail.tsx`**: Lazy-import `react-markdown` and `remark-gfm` using `React.lazy()` so they are not in the board route's initial chunk.
- **`vite.config.ts`**: Add `manualChunks` entries for `react-markdown`/`remark-gfm`/`unified` (~40KB) and `@hello-pangea/dnd` (~30KB) to improve cache granularity.

### 4. Fix window.location.href navigations
- **`src/components/board/BoardView.tsx:321`** and **`src/components/ide/IDELayout.tsx:235`**: Replace `window.location.href = '/settings'` with TanStack Router's `useNavigate()` hook for client-side navigation that preserves in-memory state.

## Effort: M

## Files affected
- `packages/app/src/stores/layout.ts` (new file -- sidebar/panel state)
- `packages/app/src/components/shared/Sidebar.tsx` (responsive classes, store integration)
- `packages/app/src/components/shared/Header.tsx` (hamburger toggle for mobile)
- `packages/app/src/routes/__root.tsx` (layout store, mobile toggle)
- `packages/app/src/components/ide/IDELayout.tsx` (adaptive panels, fix window.location)
- `packages/app/src/routes/issue.$issueKey.chat.tsx` (responsive context panel)
- `packages/app/src/components/board/FilterBar.tsx` (flex-wrap or collapse)
- `packages/app/src/components/board/BoardView.tsx` (fix window.location)
- `packages/app/src/components/board/CardDetail.tsx` (lazy-load react-markdown)
- `packages/app/src/routeTree.gen.ts` (lazy route components)
- `packages/app/src/lib/commands/default-commands.ts` (use layout store instead of DOM)
- `packages/app/vite.config.ts` (manualChunks for markdown and dnd)

## Test plan
1. **Visual regression**: Test at 375px (phone), 768px (tablet portrait), 1024px (tablet landscape), 1440px (desktop). Verify sidebar collapses, panels hide/show at correct breakpoints, and content fills available space.
2. **Interaction tests**: Toggle sidebar via hamburger button on mobile. Toggle sidebar via command palette. Toggle sidebar via keyboard shortcut. Verify all three paths use the same Zustand store and stay synchronized.
3. **Bundle analysis**: Run `npx vite-bundle-visualizer` before and after. Verify board route chunk no longer includes `react-markdown`. Verify initial bundle is < 200KB (excluding lazy chunks).
4. **Navigation tests**: Verify "Connect to Jira" CTA on board navigates to settings without page reload (no `window.location.href`). Verify in-memory state (open chat sessions, board filters) survives the navigation.
5. **Unit tests**: Test layout store toggle/persist logic. Test that lazy-loaded components render correctly with Suspense fallbacks.
