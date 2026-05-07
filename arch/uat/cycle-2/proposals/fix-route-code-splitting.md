# Proposal: Add route-level code splitting with lazy imports

## Type: fix

## Source: UAT-5 (Performance) C4; UAT-5 U6

## Problem
All route components are imported synchronously in `routeTree.gen.ts`, meaning the board (with DnD), chat (with react-markdown), and IDE (with file explorer, VFS, source control) code is all in the initial bundle even if the user never visits those routes. Additionally, `react-markdown` and `remark-gfm` are eagerly imported by `CardDetail.tsx` which is bundled with the board route. Estimated ~100KB+ of unnecessary code in the initial load.

## Solution

1. **Lazy route components**: Convert route imports in `routeTree.gen.ts` (or in each route file's `Route` definition) to use TanStack Router's `lazyRouteComponent()`:
   ```typescript
   // Instead of synchronous import:
   import { Route as BoardRoute } from './routes/board.$boardId'
   
   // Use lazy loading:
   const BoardRoute = BoardRoute.lazy(() => import('./routes/board.$boardId'))
   ```
   Apply to board, chat, and IDE routes. Keep the home and settings routes synchronous (they are small and commonly visited first).

2. **Lazy CardDetail markdown**: In `CardDetail.tsx`, dynamically import `react-markdown` and `remark-gfm`:
   ```typescript
   const ReactMarkdown = React.lazy(() => import('react-markdown'))
   ```
   Wrap the markdown rendering in `<Suspense fallback={<div className="animate-pulse h-20" />}>`.

3. **Vite `manualChunks` additions** (`vite.config.ts:24-28`): Add chunk definitions for heavy dependencies:
   ```typescript
   'markdown': ['react-markdown', 'remark-gfm', 'unified', 'micromark'],
   'dnd': ['@hello-pangea/dnd'],
   ```

## Effort: S

## Files affected
- `packages/app/src/routeTree.gen.ts` (lazy route imports -- or individual route files)
- `packages/app/src/components/board/CardDetail.tsx` (lazy import react-markdown)
- `packages/app/vite.config.ts` (additional manualChunks)

## Test plan
- Build analysis: run `npx vite-bundle-visualizer` before and after -- verify initial chunk is ~100KB smaller
- Manual test: load landing page on throttled 3G -- verify fast initial load, board/chat/IDE code loads on navigation
- Manual test: navigate to board, verify it loads correctly (lazy chunk fetched)
- Manual test: open card detail on board, verify markdown renders (lazy react-markdown loads)
- Unit test: routes render correctly after lazy loading (no flash of error)
