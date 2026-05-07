# ADR-004: Auth Architecture

## Status: Accepted

## Context

Aegis runs entirely in the browser with no backend. It must authenticate users against four OAuth providers (Red Hat SSO, GitHub, Atlassian, Google) while protecting tokens from XSS and supporting three user classes with progressive access tiers (Guest, Outside Contributor, Red Hat Employee). The browser is a public client — there is no client secret — so all OAuth flows must use PKCE.

Key forces at play:

- **No backend**: tokens cannot be stored server-side or exchanged through a confidential client
- **XSS risk**: localStorage and sessionStorage are accessible to any JavaScript running on the page, including injected scripts
- **Progressive auth**: users should not be prompted to authenticate until they access a feature that requires it
- **Federation**: Red Hat SSO federates to Atlassian (seamless), but GitHub and Google require separate OAuth flows
- **Rate limits**: Jira (100 req/min) and GitHub (5,000 req/hr) APIs require careful request management

## Decision

### 1. Progressive (lazy) auth acquisition

Auth is acquired lazily — only when a feature requires it:

| Action | Auth Required | Trigger |
|---|---|---|
| Browse public docs | None | Immediate |
| View kanban board | Jira (SSO or Atlassian) | First board open |
| Drag/transition card | Jira write scope | First mutation |
| Open IDE | GitHub OAuth | First IDE open |
| Commit / create PR | GitHub (repo scope) | First commit |
| AI Chat (RH employee) | Google OAuth (Vertex) | First AI use |
| AI Chat (contributor) | Own API key configured | First AI use |

The `AuthManager` class tracks which providers are connected and computes the current auth level. UI components call `authManager.requireAuth(provider)` and initiate the OAuth flow only if the provider is not yet connected.

### 2. Token storage: Service Worker memory

Actual OAuth tokens (access tokens, refresh tokens) live **only** in the Service Worker's memory-scoped `Map` — never in localStorage, sessionStorage, or any page-accessible JavaScript variable.

```
Main thread                          Service Worker
─────────────────                    ──────────────────────
AuthManager                          tokens = new Map()
  setToken(provider, token)  ──▶     SET_TOKEN message
                            postMessage     │
                                           ▼
                                    tokens.set(provider, token)
                                    
  (fetch /api/jira/...)      ──▶     fetch event handler
                                     injects Authorization header
                                     from tokens.get('atlassian')
```

**Why**: Service Worker scope is isolated from page JavaScript. An XSS attack that compromises the main thread cannot read the SW's `Map`. The attacker would need to register their own SW (blocked by CSP) or exploit the SW code itself.

**Trade-off**: Tokens are lost on SW termination. Token metadata (provider names, expiry timestamps — but NOT the actual tokens) is persisted in localStorage so the UI can render auth state on reload. The user may need to re-authenticate if the SW is evicted.

### 3. Token metadata in localStorage

localStorage stores only:
- Provider name (e.g., `"github"`)
- Expiry timestamp (e.g., `1716000000000`)
- Whether a refresh token exists (boolean)

This allows the UI to show which providers are connected and warn about upcoming expiry without exposing actual credentials. The `AuthManager` restores this metadata on construction to provide immediate UI state.

### 4. PKCE required for all OAuth flows

All four OAuth providers use Authorization Code flow with PKCE (S256):

- **GitHub**: `repo read:org read:user` scopes. Token exchange requires CORS proxy.
- **Atlassian**: `read:jira-work write:jira-work read:jira-user offline_access` scopes.
- **Red Hat SSO**: OIDC Authorization Code with `.well-known` discovery. `openid profile email` scopes.
- **Google**: `cloud-platform` scope for Vertex AI. Offline access for refresh token.

PKCE parameters (code_verifier, state) are stored in sessionStorage during the flow and cleared on callback. The code verifier is used for the token exchange; the state parameter prevents CSRF.

### 5. Auth federation

Red Hat SSO federates to Atlassian Cloud — RH employees get seamless Jira access via their SSO identity. However:

- **GitHub (ansible org)**: Requires separate GitHub OAuth. The `ansible-automation-platform` GitHub org is SSO-federated, but the `ansible` community org is not.
- **Google (Vertex AI)**: Requires separate Google OAuth. RH employees use their Red Hat Google Workspace accounts.

This means an RH employee may encounter up to 4 auth prompts across a session, but each is triggered lazily and only once (tokens are cached).

### 6. Content visibility tiers

The WASM engine filters content based on the current auth level:

| Auth Level | Visible Content |
|---|---|
| Guest | `public` scopes only |
| GitHub | `public` + `github` scopes |
| RedHatSSO | `public` + `github` + `redhat-sso` scopes |

Auth level is computed with strict precedence: `RedHatSSO > GitHub > Guest`. Connecting `atlassian` or `google` providers does not change the auth level — they are service providers, not identity providers.

### 7. Service Worker request management

The SW intercepts API requests and can enforce rate discipline:

- **Header injection**: Authorization headers are added to matching request patterns (Jira, GitHub, Vertex AI) without the main thread ever seeing the token
- **LLM relay**: `/_aegis/llm/{provider}/...` URLs are rewritten to actual provider endpoints with appropriate auth
- **Future**: The SW can implement request queuing/throttling to respect Jira (100/min) and GitHub (5,000/hr) rate limits

## Consequences

**Positive:**
- Tokens are immune to XSS attacks on the main thread
- Users are never prompted for auth they don't need (progressive acquisition)
- PKCE eliminates the need for a backend token exchange server (except GitHub's CORS limitation)
- The SW's fetch interceptor provides a single point for auth header injection across all API calls
- Token metadata in localStorage gives instant UI state on reload

**Negative:**
- SW eviction loses tokens — user must re-authenticate (mitigated by refresh tokens and progressive re-auth)
- GitHub token exchange requires a thin CORS proxy (Cloudflare Worker or similar)
- Four separate OAuth flows means four separate configurations to maintain
- Token refresh is provider-specific — each provider has different refresh mechanics
- The placeholder tokens (metadata-only) restored from localStorage cannot be used for API calls until the SW has actual tokens

## Alternatives Considered

- **localStorage for tokens**: Simpler but vulnerable to XSS. Any script running on the page can read tokens. Rejected for security.
- **HttpOnly cookies**: Would require a backend to set them. Not possible in a zero-infrastructure architecture. Rejected.
- **Implicit grant flow (no PKCE)**: Deprecated by OAuth 2.1. Tokens exposed in URL fragments. Rejected for security.
- **Backend-for-frontend (BFF) pattern**: Would require deploying a server for token exchange and storage. Contradicts the zero-infrastructure design principle. Rejected.
- **Web Crypto API for token encryption in localStorage**: Adds complexity but doesn't prevent XSS — if JS can encrypt, injected JS can decrypt with the same key. Rejected as security theater.
