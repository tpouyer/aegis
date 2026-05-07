# Proposal: Complete OAuth Lifecycle -- Wire Initiation, Callback, Refresh, and Expiry Handling

## Type: systemic

## Source
- **new-contributor C1**: Landing page "Connect GitHub" and "Connect SSO" buttons are non-functional (console.info stubs)
- **new-contributor C2**: Settings page "Connect" buttons for all 4 OAuth providers are non-functional (console.info stubs)
- **new-contributor C3**: No OAuth callback route exists to complete authentication
- **new-contributor U7**: Board shows infinite spinner because `initJiraClient()` is never called post-OAuth
- **new-contributor C6**: IDE makes unauthenticated API calls with no pre-check or "Connect" prompt
- **new-contributor U3**: ProviderPicker sends API key to SW with wrong type casting (`as 'github'`)
- **error-paths C2**: Token refresh is not implemented -- `refreshToken()` unconditionally throws
- **error-paths C3**: Service Worker injects expired tokens without checking expiry
- **error-paths U1**: Auth-expired error on board shows raw 401 instead of re-auth prompt
- **power-user C3**: Provider switch after session exists silently fails (calls `createSession` which returns early)

## Problem
The OAuth subsystem is architecturally complete (PKCE flows, callback handlers, AuthManager, SW token bridge) but entirely unwired: no UI element triggers `initiate*Auth()`, no route handles OAuth callbacks, token refresh is a stub, and the Service Worker injects expired tokens without checking expiry. This makes every authenticated feature -- board, IDE, chat with Vertex AI -- completely non-functional for every user class.

## Solution
Implement a vertical auth lifecycle layer that connects the existing pieces:

### 1. Wire OAuth initiation in UI (2 locations)
- **`src/routes/index.tsx`** (`handleConnectGitHub`, `handleConnectSSO`): Import and call `initiateGitHubAuth()` from `src/lib/auth/github.ts` and `initiateRedHatSSOAuth()` from `src/lib/auth/redhat-sso.ts`.
- **`src/routes/settings.tsx`** (`handleConnect`): Switch on the `provider` parameter and call the corresponding `initiate*Auth()` function from `src/lib/auth/{github,atlassian,google,redhat-sso}.ts`.

### 2. Create OAuth callback route
- Add `src/routes/auth.callback.tsx` as a new TanStack Router file route matching `/auth/callback`.
- On mount, read `code` and `state` from URL search params. Determine the provider from `state` (the existing PKCE utils store provider in sessionStorage alongside the code verifier).
- Call the appropriate `handle*Callback(code, state)` function, then `authManager.setToken(provider, tokenSet)`.
- After Atlassian auth: extract `cloudId` from the token response's accessible resources and call `initJiraClient({ cloudId, ... })`.
- Navigate to the original page (stored in sessionStorage before redirect) or fall back to `/`.

### 3. Implement token refresh
- **`src/lib/auth/manager.ts`** (`refreshToken`): Replace the stub with provider-specific refresh logic. For Atlassian and Google (which return refresh tokens), POST to the provider's token endpoint with `grant_type=refresh_token`. For GitHub (tokens don't expire in the same way), re-validate the token via the user endpoint.
- Add a `refresh_token` field to the `TokenSet` interface if not already present.
- Add retry-with-refresh logic: when `requireAuth()` detects expiry and a refresh token exists, attempt refresh before throwing.

### 4. Service Worker expiry awareness
- **`public/sw.js`** (`handleApiRequest`): Before injecting a token, check `token.expiresAt` against `Date.now()`. If expired, return a structured JSON error `{ error: 'token_expired', provider }` with status 401 instead of injecting the stale token.
- **`src/lib/fetch/resilient-fetch.ts`**: Add 401 to the retry set, but only with a special handler that triggers `authManager.refreshToken()` before retrying.

### 5. Auth pre-checks on protected routes
- **`src/routes/issue.$issueKey.ide.tsx`**: Before calling `fs.ensureBranch()`, check `authManager.isConnected('github')`. If not connected, render the auth-required EmptyState with a "Connect GitHub" CTA that calls `initiateGitHubAuth()`.
- **`src/routes/board.$boardId.tsx`**: Same pattern for Atlassian auth.

### 6. Fix ProviderPicker type casting
- **`src/components/chat/ProviderPicker.tsx:202`**: Define a union type `LLMProviderKey` that includes `'anthropic' | 'openai' | 'ollama' | 'custom'` and use it for the SW bridge call instead of casting to `'github'`.

## Effort: L

## Files affected
- `packages/app/src/routes/index.tsx` (wire initiation)
- `packages/app/src/routes/settings.tsx` (wire initiation)
- `packages/app/src/routes/auth.callback.tsx` (new file -- callback route)
- `packages/app/src/lib/auth/manager.ts` (implement refreshToken)
- `packages/app/src/lib/auth/types.ts` (extend AuthProvider or add LLMProviderKey)
- `packages/app/src/lib/auth/sw-bridge.ts` (type updates)
- `public/sw.js` (expiry check in handleApiRequest)
- `packages/app/src/lib/fetch/resilient-fetch.ts` (401 retry with refresh)
- `packages/app/src/routes/issue.$issueKey.ide.tsx` (auth pre-check)
- `packages/app/src/routes/board.$boardId.tsx` (auth pre-check)
- `packages/app/src/components/chat/ProviderPicker.tsx` (fix type casting)
- `packages/app/src/lib/jira/client.ts` (post-auth initialization hookup)
- `packages/app/src/routeTree.gen.ts` (auto-generated after adding callback route)

## Test plan
1. **Unit tests**: Test `AuthManager.refreshToken()` for each provider with mocked fetch. Test `isTokenExpired()` with tokens at various expiry times. Test SW expiry check logic.
2. **Integration tests**: Mock the full OAuth redirect flow -- click Connect, verify redirect URL, simulate callback with code/state, verify token stored in AuthManager and synced to SW.
3. **Manual E2E**: Connect GitHub from landing page, verify redirect and callback. Connect Atlassian from Settings, verify Jira board loads. Let a token expire (or manually set `expiresAt` to the past), verify auto-refresh occurs. Test with expired token and no refresh token -- verify the re-auth prompt appears instead of raw 401.
4. **Regression**: Verify existing tests for auth module (`manager.ts` tests) still pass. Verify resilientFetch tests accommodate the new 401 retry behavior.
