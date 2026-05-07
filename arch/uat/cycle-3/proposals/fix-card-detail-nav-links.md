# Proposal: Add Chat/IDE Links to CardDetail
## Type: fix
## Source: UAT C3-U4
## Problem: CardDetail panel shows issue details but has no links to navigate to AI Chat or IDE for that issue.
## Solution: Add two Link buttons in CardDetail below the SheetHeader:
```tsx
<div className="flex gap-2 mb-4">
  <Button variant="outline" size="sm" asChild>
    <Link to="/issue/$issueKey/chat" params={{ issueKey: issue.key }}>
      <MessageSquare className="mr-1 h-3.5 w-3.5" /> AI Chat
    </Link>
  </Button>
  <Button variant="outline" size="sm" asChild>
    <Link to="/issue/$issueKey/ide" params={{ issueKey: issue.key }}>
      <Code2 className="mr-1 h-3.5 w-3.5" /> Open IDE
    </Link>
  </Button>
</div>
```
## Effort: S
## Files affected:
- `src/components/board/CardDetail.tsx`
## Test plan:
- Open card detail → see "AI Chat" and "Open IDE" buttons
- Click each → navigates to correct route with issue key
