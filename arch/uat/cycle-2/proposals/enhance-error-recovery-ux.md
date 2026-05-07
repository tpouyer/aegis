# Proposal: Structured Error Recovery UX

## Type: enhancement
## Source: UAT-4 C2, UAT-4 U1, UAT-4 U3, UAT-1 U5, Cycle-1 approved: platform-structured-error-recovery
## Problem: Errors are displayed as inline text in chat messages, ErrorBoundary retry creates infinite loops, and auth expiry shows raw API errors instead of re-auth prompts.
## Solution:
1. **Chat error display**: Show errors as distinct UI elements (not inline markdown)
   - Add `error` field to ChatMessage type
   - Render error as a dismissible banner with "Retry" button below the message
   - Don't persist error text in the message content

2. **Chat retry**: Add "Retry last message" button when streaming fails
   - Remove the last (failed) assistant message
   - Re-send the last user message

3. **ErrorBoundary**: Add query cache invalidation on retry
   - On "Try again", clear relevant TanStack Query cache
   - Add `key` prop forcing child remount

4. **Auth expiry detection**: Check token expiry before API calls
   - In `resilientFetch` or the Jira/GitHub clients, detect 401 responses
   - Clear expired token metadata to trigger auth-required empty state

## Effort: M
## Files affected:
- `src/lib/llm/types.ts`
- `src/components/chat/ChatView.tsx`
- `src/components/chat/MessageList.tsx`
- `src/components/shared/ErrorBoundary.tsx`
- `src/lib/auth/manager.ts`
- `src/lib/jira/client.ts`
## Test plan:
- Trigger LLM error → see error banner, click Retry → message re-sent
- Trigger rendering error → Try Again clears cache → page re-renders correctly
- Expire Atlassian token → board shows "Connect to Jira" empty state
