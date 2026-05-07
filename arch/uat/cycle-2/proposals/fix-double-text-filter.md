# Proposal: Fix double-application of text filter on board

## Type: fix

## Source: UAT-2 (Power User) C4

## Problem
Text search is applied twice: once via JQL server-side (full-text search across description, comments, etc.) and once client-side (strict substring match on key + summary only). The client-side filter is more restrictive, so issues matching in description/comments are filtered out on the client, producing empty results even though the server returned matches.

## Solution

Remove the text filter from client-side filtering in `BoardView.tsx:92-103`. The text filter is already included in the JQL query by `buildFilterJql` at `src/lib/jira/queries.ts:312`. The client-side filter should only handle filters that are NOT in the JQL (if any).

Specifically, in `BoardView.tsx`, remove the text-matching logic from the `filteredIssues` computation:

```typescript
// BEFORE (lines 92-103):
// Applies text filter client-side on top of server-side JQL filter

// AFTER:
// Remove the `filters.text` check from client-side filtering.
// The text filter is handled entirely via JQL `text ~ "..."` in buildFilterJql.
```

Also update the comment at line 92 ("Apply client-side text filtering (other filters are handled via JQL)") to accurately reflect which filters are client-side vs server-side.

## Effort: S

## Files affected
- `packages/app/src/components/board/BoardView.tsx` (remove duplicate client-side text filter)

## Test plan
- Unit test: with `filters.text = 'foo'` set, verify that `filteredIssues` does NOT apply a client-side substring match -- all server-returned issues are included
- Manual test: search for text that appears in an issue's description but not in its summary or key -- verify the issue appears in results
- Manual test: clear the text filter -- verify all issues reappear
