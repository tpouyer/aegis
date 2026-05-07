# Proposal: Make ToolResult Collapsible Keyboard-Accessible
## Type: fix
## Source: UAT C3-U1
## Problem: ToolResult header is a div with onClick but no keyboard semantics — keyboard users can't expand/collapse tool call results.
## Solution: Add `role="button"`, `tabIndex={0}`, and `onKeyDown` handler to CardHeader:
```tsx
<CardHeader
  className="cursor-pointer select-none p-3"
  onClick={toggle}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
  role="button"
  tabIndex={0}
  aria-expanded={expanded}
>
```
## Effort: S
## Files affected:
- `src/components/chat/ToolResult.tsx`
## Test plan:
- Tab to tool result header → focus visible
- Press Enter or Space → expands/collapses
- aria-expanded reflects state
