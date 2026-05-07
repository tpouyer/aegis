# Feature: Structured Error Recovery with Contextual Guidance

## User Story
As a developer using the Aegis platform, I want errors to be categorized and presented with specific recovery actions so that I can resolve issues myself instead of refreshing the page and losing my work.

## Problem
Aegis currently has two error-handling mechanisms, both limited:

1. **ErrorBoundary** (`components/shared/ErrorBoundary.tsx`) -- catches React render errors and shows a generic "Something went wrong" message with a "Try again" button that re-renders the subtree. The error message is the raw `Error.message`, which for API errors looks like "Jira API error: 401 Unauthorized -- ..." -- not actionable for the user.
2. **Toast notifications** (`stores/toast.ts`) -- supports success/error/info types. Error toasts show the raw error message and auto-dismiss after 5 seconds, which is too fast for the user to read a complex error and decide what to do.

Missing capabilities:
- **No error categorization.** A 401 (auth expired) is treated the same as a 500 (server error). A 401 should prompt re-authentication; a 500 should suggest retry.
- **No per-feature recovery actions.** When an IDE commit fails due to a conflict (422), the user should see "Your branch is behind. Pull the latest changes." not a generic error.
- **No error persistence.** Errors vanish after 5 seconds. There is no error log the user can review.
- **Auth errors are silent.** When a token expires mid-session, the next API call fails with a raw error. The `AuthManager` has `refreshToken()` but it is unimplemented (throws immediately). There is no automatic re-auth prompt.

This is especially painful during multi-step workflows like: edit file -> commit -> create PR -> transition Jira issue. If step 3 fails, the user gets a toast that disappears, with no way to retry just that step.

## Proposed Solution

### 1. Error classification enum
Define a structured error taxonomy:

```typescript
enum ErrorCategory {
  AUTH_EXPIRED,      // 401 -- token expired, prompt re-auth
  AUTH_FORBIDDEN,    // 403 -- insufficient permissions
  RATE_LIMITED,      // 429 -- back off, auto-retry
  NOT_FOUND,        // 404 -- resource deleted or wrong key
  CONFLICT,         // 409/422 -- concurrent edit, stale branch
  NETWORK,          // TypeError, offline -- check connection
  SERVER,           // 5xx -- transient, suggest retry
  CLIENT,           // 4xx other -- user input problem
  UNKNOWN,          // catch-all
}
```

### 2. Error-to-action mapping
Each error category maps to a recovery action:

| Category | Toast behavior | Action button | Auto-behavior |
|---|---|---|---|
| AUTH_EXPIRED | Persistent (no auto-dismiss) | "Re-authenticate" | Opens OAuth flow for the relevant provider |
| RATE_LIMITED | Auto-dismiss after backoff | "Retry in Xs" | Auto-retry after Retry-After (see resilient-fetch proposal) |
| CONFLICT | Persistent | "Pull latest" / "Force push" | None -- user must decide |
| NETWORK | Persistent until online | "Retry" | Auto-retry on `navigator.onLine` change |
| SERVER | 10-second dismiss | "Retry" | None |

### 3. Error history panel
Add a collapsible error log in the app header (bell icon with badge count). Clicking opens a dropdown showing the last 20 errors with timestamps, categories, and retry buttons. This replaces the need for users to remember what the 5-second toast said.

### 4. Auth-expired interceptor
Add a global fetch interceptor (or hook into the resilient-fetch layer) that detects 401 responses and:
1. Determines which provider's token expired (based on the request URL).
2. Pauses all pending requests to that provider.
3. Shows a persistent "Session expired -- click to re-authenticate" banner.
4. On re-auth success, replays the paused requests.

## Impact Assessment
- **User impact:** High -- transforms error handling from "cryptic toast that disappears" to "actionable guidance with one-click recovery." Directly reduces user frustration in the most common failure modes (auth expiry, rate limits, network drops).
- **Effort estimate:** M -- error classification is straightforward; the auth-expired interceptor requires careful coordination with `AuthManager`. Error history panel is a small UI addition.
- **Risk:** Over-classification could lead to wrong recovery suggestions. Mitigate by defaulting to `UNKNOWN` with generic messaging for unrecognized errors. The auth-replay queue must handle the case where re-auth fails (drain the queue with errors, do not retry forever).

## Competitive Analysis
- **VS Code:** VS Code classifies errors by source (extension, editor core, file system) and provides specific recovery actions. "Extension host crashed -- restart extension host" is a good example of contextual recovery.
- **github.dev:** Shows a persistent yellow banner on 401 with "Sign in again" that preserves unsaved work. Uses a request queue that drains after re-auth.
- **Figma:** Figma shows a persistent "Could not save -- retrying..." bar for network/save errors with a manual "Save now" button. Never loses local state.
- **Slack:** Slack shows a yellow "connecting..." banner when the WebSocket drops, with a "Try now" button. Queues messages locally and sends them when reconnected.

## Technical Sketch
### New files
- `lib/errors/error-classifier.ts` -- classifies raw errors (Response, Error, DOMException) into `ErrorCategory` with extracted metadata (provider, retry-after, etc.).
- `lib/errors/types.ts` -- `ClassifiedError` type, `ErrorCategory` enum, recovery action types.
- `components/shared/ErrorHistory.tsx` -- dropdown panel showing recent classified errors with action buttons.

### Modified files
- `stores/toast.ts` -- extend `ToastMessage` with `category`, `actions` (array of { label, onClick }), and `persistent` flag. Error toasts with `persistent: true` do not auto-dismiss.
- `components/shared/Toaster.tsx` -- render action buttons on error toasts when provided.
- `components/shared/Header.tsx` -- add error history icon/badge.
- `lib/auth/manager.ts` -- implement the 401 interceptor: on `AUTH_EXPIRED`, queue requests, show re-auth prompt, and replay on success.
- `lib/jira/client.ts` -- wrap errors from `request()` through the classifier before throwing.
- `lib/vfs/virtual-fs.ts` -- wrap GitHub API errors through the classifier, especially for commit conflicts (422).

### Not affected
- No changes to WASM engine, build pipeline, or Service Worker protocol.
- No new dependencies.
