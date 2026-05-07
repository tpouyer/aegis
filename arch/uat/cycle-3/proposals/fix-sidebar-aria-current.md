# Proposal: Add aria-current to Active Sidebar Link
## Type: fix
## Source: UAT C3-P3, C3-P4
## Problem: Active sidebar link has visual highlight but no aria-current="page", and board column headers use h3 without parent h2.
## Solution:
1. In Sidebar.tsx, add aria-current to activeProps:
```tsx
activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' as const }}
```
2. In Column.tsx, change h3 to h2 for column headers.
## Effort: S
## Files affected:
- `src/components/shared/Sidebar.tsx`
- `src/components/board/Column.tsx`
## Test plan:
- Screen reader announces "current page" on active sidebar link
- Heading scan shows h2 for board column names
