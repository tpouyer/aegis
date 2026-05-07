# Proposal: Structured Error Recovery and Auth Resilience

## Type: enhancement

## Source
**UAT findings addressed:**
- Error Paths C2: Token refresh is not implemented -- all providers silently fail after expiration
- Error Paths C3: Service Worker injects expired tokens without checking expiry
- Error Paths U1: Auth-expired error on board shows raw API error, not re-auth prompt
- Error Paths U3: ErrorBoundary retry does not re-fetch data or reset route state
- Error Paths P2: TanStack Query does not have a global error handler
- New Contributor U4: Empty state CTAs use `window.location.href` instead of client-side navigation (full page reload loses state)
- New Contributor U7: Board shows "Loading board..." spinner indefinitely when JiraClient is not initialized
- Power User U5: Sidebar toggle and theme toggle via command palette use DOM manipulation, desynchronizing React state (tangential but related to error state management)
- Accessibility P3: ErrorBoundary retry button should receive focus on error

**Cycle 1 features addressed:**
- **platform-structured-error-recovery** (5/5 approved): Error classification enum, error-to-action mapping, error history panel, auth-expired interceptor
- **growth-progressive-auth-nudges** (5/5 approved): Inline auth prompts replacing modal blocking, auth redirect preservation, smart provider recommendation (partially -- the auth interceptor and inline re-auth prompt aspects)

## Problem
When tokens expire (Atlassian ~1hr, GitHub ~8hr), the app silently injects stale tokens, receives 401s that are not in the retry set, and surfaces raw API errors ("Jira API error: 401 Unauthorized") with no actionable guidance. The ErrorBoundary "Try again" button re-renders with stale cached data, creating infinite crash loops. There is no error categorization, no recovery actions, no error persistence, and auth-required empty states use full-page reloads that destroy in-memory state.

## Solution

### 1. Error classification layer (`src/lib/errors/`)
Create `error-classifier.ts` with an `ErrorCategory` enum (AUTH_EXPIRED, AUTH_FORBIDDEN, RATE_LIMITED, NOT_FOUND, CONFLICT, NETWORK, SERVER, CLIENT, UNKNOWN) and a `classifyError(error: unknown): ClassifiedError` function that inspects HTTP status codes, error types, and message patterns.

### 2. Service Worker token expiry check
In `public/sw.js` `handleApiRequest()`, before injecting a token, check `token.expiresAt` against `Date.now()`. If expired, respond with a structured JSON error `{ error: 'token_expired', provider }` instead of injecting the stale token. This prevents the 401 round-trip entirely.

### 3. AuthManager token refresh stub upgrade
In `src/lib/auth/manager.ts`, replace the throwing `refreshToken()` stub with logic that: (a) clears the expired token from memory and localStorage metadata, (b) updates `isConnected()` to return false, (c) dispatches a custom event `aegis:auth-expired` with the provider name. This ensures downstream checks like `authManager.isConnected('atlassian')` correctly return false, triggering the auth-required empty state instead of raw errors.

### 4. Global 401 interceptor in resilientFetch
In `src/lib/fetch/resilient-fetch.ts`, add 401 to a special handler (not the retry set). On 401: call `authManager.clearToken(provider)`, classify the error as AUTH_EXPIRED, and throw a `ClassifiedError` with `recoveryAction: 're-authenticate'`.

### 5. Enhanced toast system
In `src/stores/toast.ts`, extend `ToastMessage` with `category: ErrorCategory`, `actions: Array<{ label: string; onClick: () => void }>`, and `persistent: boolean`. AUTH_EXPIRED toasts are persistent with a "Re-authenticate" button that calls `initiateGitHubAuth()` / `initiateAtlassianAuth()`. NETWORK toasts are persistent until `navigator.onLine` changes. SERVER toasts auto-dismiss after 10 seconds with a "Retry" button.

### 6. ErrorBoundary improvements
In `src/components/shared/ErrorBoundary.tsx`: (a) on retry, invalidate all TanStack Query caches via `queryClient.invalidateQueries()` before resetting error state, (b) auto-focus the retry button via `useRef` + `useEffect`, (c) classify the caught error and show category-appropriate messaging and recovery actions.

### 7. Fix empty state navigation
In `src/components/board/BoardView.tsx` and `src/components/ide/IDELayout.tsx`, replace `window.location.href = '/settings'` with TanStack Router's `navigate({ to: '/settings' })` to preserve SPA state.

## Effort: M

## Files affected
- `src/lib/errors/error-classifier.ts` (new)
- `src/lib/errors/types.ts` (new)
- `public/sw.js` (modify `handleApiRequest` for expiry check)
- `src/lib/auth/manager.ts` (upgrade `refreshToken`, add `clearToken`)
- `src/lib/fetch/resilient-fetch.ts` (add 401 handler)
- `src/stores/toast.ts` (extend ToastMessage type)
- `src/components/shared/Toaster.tsx` (render action buttons, persistent mode)
- `src/components/shared/ErrorBoundary.tsx` (cache invalidation, focus management, classification)
- `src/components/board/BoardView.tsx` (fix navigation, use classified errors)
- `src/components/ide/IDELayout.tsx` (fix navigation, use classified errors)
- `src/lib/jira/client.ts` (classify errors before throwing)
- `src/lib/vfs/virtual-fs.ts` (classify GitHub API errors)

## Test plan
- Unit test `error-classifier.ts`: verify correct classification of 401, 403, 404, 409, 422, 429, 500, 502, 503, TypeError (network), and unknown errors
- Unit test enhanced toast store: verify persistent toasts do not auto-dismiss, action buttons render correctly
- Integration test: mock an expired Atlassian token in SW, verify board shows auth-required empty state (not raw error)
- Integration test: mock a 500 from Jira API, verify error toast with "Retry" button appears and retries on click
- Verify ErrorBoundary retry invalidates query cache by mocking a render error, clicking retry, and confirming fresh data is fetched
- Verify empty state CTAs use client-side navigation by checking no full page reload occurs (no `window.location.href` assignment)
- Accessibility: verify ErrorBoundary retry button receives focus automatically on error render
- Manual test: let an Atlassian token expire naturally (~1hr), confirm the app shows a persistent "Re-authenticate" toast instead of a raw 401 error
