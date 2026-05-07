# Repository Guidelines

Hard-won rules from building and deploying Aegis. Read this before making changes.

## GitHub Pages Deployment

### Base path is `/aegis/` — every URL must account for it

- **Vite config**: `base` is set from `VITE_BASE_PATH` env var (set to `/aegis/` in the publish workflow). Use `import.meta.env.BASE_URL` everywhere you construct URLs.
- **TanStack Router**: `basepath` is set from `import.meta.env.BASE_URL` in `main.tsx`. All `<Link>` components handle this automatically. Never hardcode paths like `/settings` in `window.location.href` — use `useNavigate()` or `<Link>`.
- **fetch() calls to local resources**: Must prefix with `import.meta.env.BASE_URL`. Example: the `.well-known/aegis-configuration` fetch uses `` `${import.meta.env.BASE_URL}.well-known/aegis-configuration` ``.
- **Service Worker registration**: Uses `${import.meta.env.BASE_URL}sw.js` with scope `import.meta.env.BASE_URL`.
- **LLM relay URLs**: Providers use `${import.meta.env.BASE_URL}_aegis/llm/{provider}/...`. The SW matches `/_aegis/llm/` anywhere in the pathname.
- **OAuth redirect URIs**: Built with `${window.location.origin}${import.meta.env.BASE_URL}auth/callback?provider=...`.

If you add a new route, fetch call, or resource reference — **use `import.meta.env.BASE_URL`**, not a hardcoded `/` path.

### SPA routing via 404.html

GitHub Pages doesn't support client-side routing natively. The Vite build copies `index.html` as `404.html` in the dist output (via the `spa-fallback-404` plugin in `vite.config.ts`). This means any unknown path serves the full SPA, and the client-side router handles the URL.

**Do not** create a separate `public/404.html` with redirect logic — it breaks OAuth callbacks by mangling query parameters.

### CSP is production-only

The Content-Security-Policy meta tag is injected only in production builds via the `inject-csp` Vite plugin. Dev mode has no CSP so Vite's HMR inline scripts work. If you need to add a new external domain (API, CDN, etc.), update the `cspMeta` string in `vite.config.ts`.

Currently allowed in `connect-src`: `api.github.com`, `*.atlassian.net`, `*.atlassian.com`, `auth.atlassian.com`, `api.anthropic.com`, `api.openai.com`, `*.googleapis.com`, `accounts.google.com`, `github.com`, `*.workers.dev`.

## OAuth

### GitHub uses standard OAuth, NOT PKCE

GitHub OAuth Apps don't support `code_challenge`/`code_challenge_method` params. Sending them causes a 404 from GitHub. Only use PKCE for Atlassian, Google, and Red Hat SSO.

### Token exchange needs a server-side proxy

GitHub and Google token exchanges require `client_secret` which can't be in browser code. A Cloudflare Worker at `workers/github-oauth-proxy/` proxies both, injecting secrets from `wrangler secret`. The proxy URL is set in `.well-known/aegis-configuration` as `auth.githubTokenProxyUrl`.

If you add a new OAuth provider that requires `client_secret`, extend the worker — don't try to put secrets in the browser.

### OAuth state uses localStorage, NOT sessionStorage

The GitHub Pages 404.html SPA redirect creates a new navigation that clears `sessionStorage` in some browsers. All OAuth state parameters and PKCE verifiers are stored in `localStorage` and cleaned up after the callback.

### Tokens persist to localStorage

Full OAuth tokens (including `accessToken`) are persisted to `localStorage` so they survive page reloads and cross-provider auth flows (connecting GitHub no longer loses your Google token). This is a trade-off: tokens are accessible to page JS, which is acceptable for a dev tool.

## LLM Providers

### API-key providers call APIs directly

OpenAI and Anthropic providers call `api.openai.com` and `api.anthropic.com` directly with the API key in the request header. They do **not** use the Service Worker relay. This is because the SW registration is async and unreliable on first visit.

### Vertex AI needs the Google OAuth token

The Vertex provider gets the Google OAuth token from `authManager.getState().tokens.google.accessToken` at registration time. If the token is empty (user hasn't connected Google, or page was reloaded before token persistence was added), it shows a clear error message instead of making an unauthenticated request.

### Provider configs are persisted

The `llm-config` Zustand store (`src/stores/llm-config.ts`) persists configured providers to `localStorage`. On app startup, `restoreProviders()` in `src/lib/llm/restore-providers.ts` re-registers all saved providers. When adding a new provider type, update both `ProviderPicker.tsx` (handleSave) and `restore-providers.ts`.

### The chat model dropdown shows ALL providers

The dropdown in the chat header lists every registered provider's models, grouped by provider name. Users switch providers with one click. If you change the provider registry or add new provider types, the dropdown picks them up automatically.

### Chat sessions persist provider and model

Each chat session stores `providerId` and `currentModel`. When the user revisits a chat, the session is loaded from IndexedDB with its original provider/model. The `sessionKey()` helper in `stores/chat.ts` creates a composite key (`issueKey|providerId|modelId`) for future multi-provider session scoping. A "Clear Chat" button (trash icon) in the chat header deletes the session from memory and IndexedDB.

## Jira

### API token auth as alternative to OAuth

Jira OAuth requires admin-approved Atlassian OAuth apps. As an alternative, users can configure API token auth via Settings > Integrations > Atlassian > Configure. This stores `baseUrl`, `email`, and `apiToken` in the `jira-config` Zustand store (persisted to localStorage).

When API token auth is active, the Jira client routes requests through the Cloudflare Worker at `workers/github-oauth-proxy/` (route: `/jira/*`). The worker receives `X-Jira-Base-URL` and `X-Jira-Auth` headers, forwards to Jira with Basic Auth, and adds CORS headers. The proxy URL comes from `auth.githubTokenProxyUrl` in `.well-known/aegis-configuration`.

If you add new Jira API endpoints, they automatically route through the proxy when token auth is configured — no per-endpoint changes needed.

## Zustand Stores

There are 11 stores. All use the same pattern: Zustand `create()`, optional `localStorage` persistence via manual `getItem`/`setItem` in a `try/catch`.

| Store | localStorage key | What it persists |
|-------|-----------------|-----------------|
| `board.ts` | none | Transient drag/filter state |
| `chat.ts` | IndexedDB `aegis-chat` | Chat sessions (7-day TTL) |
| `ide.ts` | none | Transient editor state |
| `theme.ts` | `aegis_theme` | Light/dark preference |
| `sidebar.ts` | none | Mobile sidebar open state |
| `telemetry.ts` | `aegis_telemetry` | OTEL endpoint/interval |
| `recent.ts` | `aegis_recent_issues` | Last 8 visited issues |
| `persona.ts` | `aegis_persona` | Selected role |
| `llm-config.ts` | `aegis_llm_providers` | Provider configs + API keys |
| `jira-config.ts` | `aegis_jira_config` | Jira API token credentials (baseUrl, email, apiToken) |
| `toast.ts` | none | Transient toast notifications |

When adding a new store: use `try/catch` around all `localStorage` calls (tests use jsdom where localStorage may not behave like a browser). Apply initial state from localStorage in the store factory function, not in a `useEffect`.

## Theme

The theme store must **apply** the `dark` class to `document.documentElement` during initialization — not just read the preference. This was a bug: the store read `localStorage` correctly but didn't toggle the class, so the page rendered light on every reload.

## Testing

- **313 tests** across 25 suites. Never let the count go down.
- Tests run in **jsdom** — `localStorage.getItem` may throw `TypeError` instead of returning `null`. Always wrap in `try/catch`.
- **OTEL is no-op in tests** — no `MeterProvider` is registered, so all meter calls are zero-cost no-ops.
- The **pre-commit hook** runs TypeScript type checking, Biome lint, and all tests. Don't skip it (`--no-verify`).
- **Biome** enforces formatting and lint rules. Run `npm run format` before committing to avoid CI failures.
- **`routeTree.gen.ts`** is auto-generated by TanStack Router — excluded from Biome lint/format.

## OpenTelemetry

- Uses `@opentelemetry/resources` v2.x — use `resourceFromAttributes()`, NOT the old `Resource` class.
- `MeterProvider` takes `readers` array in the constructor — don't use `.addMetricReader()` (removed in v2).
- Console exporter only runs in `import.meta.env.DEV` mode.

## Common Pitfalls

1. **`useCallback` dependency arrays** — Biome warns about missing deps. Always add them. Stale closures are a real bug source (e.g., the `gcpProject` stale closure in ProviderPicker).

2. **`require()` in Vite config** — Vite config is ESM. Use `import` at the top level, not `require()` inside functions.

3. **Sub-agents can't reliably write files** — If you use Claude Code's Agent tool to delegate work, the sub-agents often fail to write files. Verify file creation after agent runs and implement directly if needed.

4. **Service Worker scope** — The SW scope must match the base path. If the app is at `/aegis/`, the SW must be registered with `scope: '/aegis/'`. Requests outside this scope won't be intercepted.

5. **GitHub Pages caching** — After deploying, hard refresh (`Cmd+Shift+R`) to clear the old JS bundle. The SW may serve stale cached content.
