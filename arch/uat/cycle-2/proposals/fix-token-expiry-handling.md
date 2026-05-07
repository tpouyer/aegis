# Proposal: Implement token expiry detection and re-auth flow

## Type: fix

## Source: UAT-4 (Error Paths) C2, C3, U1

## Problem
Token refresh is a stub that unconditionally throws. The Service Worker injects expired tokens without checking `expiresAt`. After tokens expire (~1hr for Atlassian), all API calls fail with 401 errors. The board shows a raw "Jira API error: 401 Unauthorized" instead of the helpful re-auth empty state, because `authManager.isConnected()` still returns true from stale localStorage metadata.

## Solution

**Phase 1 -- Detect and surface expiry (this proposal):**

1. **`AuthManager.isConnected()` (`src/lib/auth/manager.ts:77-80`)**: Add expiry checking. Currently only checks if metadata exists in localStorage. Update to also check `metadata.expiresAt` -- if the token is expired, return `false` and clear the stale metadata.

2. **`AuthManager.requireAuth()` (`src/lib/auth/manager.ts:55-66`)**: When expiry is detected, instead of calling the broken `refreshToken()`, clear the token metadata, notify the SW to drop the token, and throw a typed `AuthExpiredError` that UI components can catch to show the re-auth prompt.

3. **Service Worker (`public/sw.js:154-166`)**: In `handleApiRequest()`, check `token.expiresAt` before injection. If expired:
   - Delete the token from the `tokens` Map
   - Return a structured error response (e.g., `{ status: 401, body: { error: 'token_expired', provider } }`) so the main thread can distinguish expiry from other 401s.

4. **Board error handling (`src/components/board/BoardView.tsx:307-310`)**: Add a check for 401 status in the error object. If the error is a 401, treat it as an auth-required state regardless of `isConnected()` return value. Clear the stale connection metadata.

5. **Add `resilientFetch` awareness of 401**: In `src/lib/fetch/resilient-fetch.ts:29`, do NOT add 401 to the retry set (retrying with expired tokens is pointless). Instead, detect 401 and throw an `AuthExpiredError` so callers can handle it.

**Phase 2 (future):** Implement actual token refresh using refresh tokens stored in the SW. This is more complex and can be a separate proposal.

## Effort: M

## Files affected
- `packages/app/src/lib/auth/manager.ts` (expiry-aware `isConnected`, `requireAuth` cleanup)
- `public/sw.js` (token expiry check before injection)
- `packages/app/src/components/board/BoardView.tsx` (handle 401 as auth-required)
- `packages/app/src/components/ide/IDELayout.tsx` (handle 401 as auth-required)
- `packages/app/src/lib/fetch/resilient-fetch.ts` (surface 401 distinctly, no retry)

## Test plan
- Unit test: `isConnected('atlassian')` returns false when `expiresAt` is in the past
- Unit test: `isConnected('atlassian')` returns true when `expiresAt` is in the future
- Unit test: SW `handleApiRequest` with expired token returns structured 401, not injecting the expired token
- Unit test: BoardView with 401 error shows auth-required empty state, not raw error
- Manual test: connect Atlassian, manually set `expiresAt` to past in localStorage, refresh page, verify re-auth prompt appears
- Manual test: verify board transitions from "loading" to "connect to Jira" (not "Jira API error") when token is expired
