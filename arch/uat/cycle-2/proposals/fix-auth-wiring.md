# Proposal: Wire OAuth flows to UI buttons and add callback route

## Type: fix

## Source: UAT-1 (New Contributor) C1, C2, C3

## Problem
All four OAuth providers (GitHub, Atlassian, Google, Red Hat SSO) have fully implemented `initiate*Auth()` and `handle*Callback()` functions in `src/lib/auth/`, but they are never imported or called from any UI component. The Landing page "Connect GitHub" button, Settings page "Connect" buttons, and the entire OAuth callback flow are non-functional. This is a **complete blocker** -- no user can authenticate, making Board, IDE, and commit features inaccessible.

## Solution

1. **Landing page (`src/routes/index.tsx`)**: Import `initiateGitHubAuth` from `src/lib/auth/github.ts` and `initiateAtlassianAuth` from `src/lib/auth/atlassian.ts`. Replace the `console.info` stubs in `handleConnectGitHub` (line 109-111) and `handleConnectSSO` (line 113-115) with actual calls to `initiateGitHubAuth()` and `initiateAtlassianAuth()` respectively.

2. **Settings page (`src/routes/settings.tsx`)**: Import all four auth initiation functions. Replace the `handleConnect` stub (line 77-79) with a switch on `provider` that calls the correct `initiate*Auth()` function:
   - `'github'` -> `initiateGitHubAuth()`
   - `'atlassian'` -> `initiateAtlassianAuth()`
   - `'google'` -> `initiateGoogleAuth()`
   - `'redhat-sso'` -> `initiateRedHatAuth()`

3. **New callback route (`src/routes/auth.callback.tsx`)**: Create a new TanStack Router route that:
   - Reads `code` and `state` from the URL search params
   - Determines which provider initiated the flow (from `state` or sessionStorage)
   - Calls the appropriate `handle*Callback(code, state)` function
   - Stores the resulting token via `authManager.setToken()`
   - For Atlassian: extracts `cloudId` from the token response and calls `initJiraClient({ cloudId, token })`
   - Redirects to the original page (stored in sessionStorage before the OAuth redirect)
   - Shows a loading spinner during the exchange and an error state if it fails

4. **Jira client initialization**: In the callback handler for Atlassian, after receiving the access token, call the Atlassian accessible resources API (`/oauth/token/accessible-resources`) to get the `cloudId`, then call `initJiraClient()`. This also addresses UAT-1 U7 (JiraClient never initialized).

## Effort: M

## Files affected
- `packages/app/src/routes/index.tsx` (wire landing page buttons)
- `packages/app/src/routes/settings.tsx` (wire settings connect buttons)
- `packages/app/src/routes/auth.callback.tsx` (new file -- callback route)
- `packages/app/src/routeTree.gen.ts` (auto-generated, will update with new route)
- `packages/app/src/lib/auth/manager.ts` (may need helper for provider detection from state)

## Test plan
- Unit test: mock `initiateGitHubAuth` and verify clicking "Connect GitHub" on landing page calls it
- Unit test: mock all four `initiate*Auth` and verify Settings connect buttons dispatch the correct one
- Unit test: callback route with mocked `handle*Callback` -- verify token exchange, `setToken`, and redirect
- Integration test: full OAuth round-trip with a mock provider (intercept the redirect, simulate callback)
- Manual test: click "Connect GitHub" on landing page, verify redirect to `github.com/login/oauth/authorize` with correct `client_id`, `redirect_uri`, `code_challenge`, and `state`
- Manual test: complete GitHub OAuth, verify callback route processes the code and redirects back
- Manual test: verify Settings page shows "Connected" status after successful auth
