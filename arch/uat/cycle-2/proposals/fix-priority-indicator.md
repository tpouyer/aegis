# Proposal: Replace Color-Only Priority Indicator with Text+Icon

## Type: fix
## Source: UAT-3 C4
## Problem: Issue priority on board cards is conveyed only via a 2x2px colored dot — color-blind users (~8% of males) cannot distinguish priorities. Violates WCAG 1.4.1.
## Solution:
Replace the colored dot with a text badge or icon+text indicator:

```tsx
// In Card.tsx, replace the priority dot with:
<Badge variant="outline" className="text-[10px] px-1.5 py-0">
  <span className={`inline-block h-1.5 w-1.5 rounded-full ${priorityColor} mr-1`} />
  {fields.priority.name}
</Badge>
```

This shows both the color AND the text label ("High", "Medium", "Low"), satisfying WCAG 1.4.1.

## Effort: S
## Files affected:
- `src/components/board/Card.tsx`
## Test plan:
- Verify priority text is visible on all cards
- View with a color blindness simulator — priority is still readable
- Verify card layout doesn't break with longer priority names
