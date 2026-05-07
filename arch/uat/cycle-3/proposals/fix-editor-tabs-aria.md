# Proposal: Add Tab Role Semantics to EditorTabs
## Type: fix
## Source: UAT C3-U2
## Problem: IDE editor tabs lack ARIA tab semantics — screen readers don't announce tab navigation.
## Solution: Add `role="tablist"` to container, `role="tab"` and `aria-selected` to each tab.
## Effort: S
## Files affected:
- `src/components/ide/EditorTabs.tsx`
## Test plan:
- Screen reader announces "tab list" and "tab, selected" on active tab
- Arrow keys work for tab navigation
