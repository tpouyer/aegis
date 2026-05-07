# Proposal: Add Skip Navigation and Fix Heading Hierarchy

## Type: fix
## Source: UAT-3 C1, UAT-3 C3, UAT-3 U5, UAT-3 U6, UAT-3 U7
## Problem: No skip navigation link exists (WCAG 2.4.1), page titles don't update on route changes (WCAG 2.4.2), and heading hierarchy is broken across all routes.
## Solution:
1. Add skip link to root layout:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background">
  Skip to main content
</a>
```

2. Add `id="main-content"` to the `<main>` element in `__root.tsx`

3. Add `document.title` updates in each route component's useEffect:
```tsx
useEffect(() => { document.title = 'Board - Aegis' }, [])
```

4. Fix heading hierarchy:
- Board page: add h1 "Board" or h2 column headers
- Chat page: add h1 for issue key
- IDE page: add h1 for "IDE - {issueKey}"
- Column headers: change from h3 to h2

## Effort: S
## Files affected:
- `src/routes/__root.tsx`
- `src/routes/index.tsx`
- `src/routes/board.$boardId.tsx`
- `src/routes/issue.$issueKey.chat.tsx`
- `src/routes/issue.$issueKey.ide.tsx`
- `src/routes/settings.tsx`
- `src/components/board/Column.tsx`
## Test plan:
- Tab from page load → first focusable element is "Skip to main content"
- Activate skip link → focus moves to main content
- Navigate between routes → document title updates
- Screen reader heading scan → h1 → h2 → h3 hierarchy is correct
