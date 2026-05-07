# Proposal: Fix Sidebar Board Navigation

## Type: fix
## Source: UAT-1 C4, UAT-1 C5, UAT-2 C2, UAT-5 C1 (related: sidebar width)
## Problem: Sidebar "Board" link navigates to `/board/default` which triggers NaN validation error, while `g b` shortcut navigates to `/board/1` — both are broken or inconsistent.
## Solution:
1. Change sidebar boardId from `'default'` to `'1'` in `src/components/shared/Sidebar.tsx:19`
2. Change landing page boardId from `'default'` to `'1'` in `src/routes/index.tsx:132`
3. Change board route to accept string IDs (remove NaN check, or treat non-numeric as lookup-by-name)
4. Alternatively: make `default` a valid board ID that redirects to the user's first board

Recommended approach: Use string `'1'` consistently as the default board ID across sidebar, landing page, keyboard shortcut, and command palette.

## Effort: S
## Files affected:
- `src/components/shared/Sidebar.tsx`
- `src/routes/index.tsx`
- `src/lib/commands/default-commands.ts`
- `src/routes/board.$boardId.tsx`
## Test plan:
- Click "Board" in sidebar → should load board without error
- Press `g b` → same board loads
- Click "Browse" on landing page → same board loads
- Navigate to `/board/abc` → shows appropriate error message
