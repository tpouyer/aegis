# Proposal: Add Tree Role Semantics to FileExplorer
## Type: fix  
## Source: UAT C3-U3
## Problem: File explorer lacks ARIA tree semantics — screen readers don't convey the tree structure.
## Solution: Add `role="tree"` to container, `role="treeitem"` to items, `aria-expanded` to directories.
## Effort: S
## Files affected:
- `src/components/ide/FileExplorer.tsx`
## Test plan:
- Screen reader announces "tree" when entering explorer
- Directories announced as "expanded" or "collapsed"
- Files announced as "tree item"
