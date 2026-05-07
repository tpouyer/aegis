# Proposal: Sanitize Markdown Links to Prevent XSS
## Severity: High (P1)
## Finding: F2 (T11)
## Problem: ReactMarkdown renders links without filtering `javascript:` or `data:` URI schemes, enabling XSS via crafted markdown in LLM responses or Jira data.
## Solution:
Create a custom link component that validates href schemes:

```tsx
function SafeLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const safeHref = href && /^(https?:|mailto:|#)/.test(href) ? href : undefined;
  if (!safeHref) return <span>{children}</span>;
  return <a href={safeHref} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
}
```

Pass to ReactMarkdown: `components={{ a: SafeLink }}`
Apply in: MessageList.tsx, CardDetail.tsx
## Effort: S
## Files: `src/components/chat/MessageList.tsx`, `src/components/board/CardDetail.tsx`, new `src/components/shared/SafeLink.tsx`
## Test: Render markdown with `[test](javascript:alert(1))` → renders as plain text, not clickable link.
