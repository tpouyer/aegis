# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aegis is a zero-infrastructure development platform served as a single WASM binary from a static site (GitHub Pages). It combines organizational context delivery, MCP tool aggregation, and an AI-native development surface (kanban board, AI chat, browser IDE) — all running entirely in the browser with no backend.

The design document lives at `docs/design.md`. The threat model is at `docs/security/threat-model.md`. User stories are at `docs/user-stories.md`. The API reference (all TypeScript interfaces, store shapes, component props) is at `docs/api-reference.md`. **Repository guidelines (MUST READ before making changes)** are at `REPOSITORY.md` — covers base path rules, OAuth gotchas, provider architecture, and common pitfalls learned during development.

## Repository Structure

This is a monorepo with two packages:

- **`packages/app/`** — React SPA (Vite, TypeScript)
- **`packages/engine/`** — Rust WASM module (compiled via `wasm-pack`)
- **`config/`** — scope definitions (`scopes.yml`) and component-to-repo mapping (`components.yml`)
- **`packages/app/public/.well-known/aegis-configuration`** — runtime deployment config (see Configuration section)
- **`workers/github-oauth-proxy/`** — Cloudflare Worker for OAuth token exchange (GitHub + Google client_secret injection) and Jira API CORS proxy (`/jira/*`)

## Build Commands

```bash
# WASM engine (from packages/engine/)
cargo build --target wasm32-unknown-unknown
wasm-pack build --target web --out-dir ../app/src/wasm

# React SPA (from packages/app/)
npm run dev          # dev server
npm run build        # tsc --noEmit + vite build
npm run test         # vitest run (313 tests)
npm run lint         # tsc --noEmit (API contract validation)
npm run lint:biome   # Biome lint + format check

# Rust tests (from packages/engine/)
cargo test           # 37 tests

# Full build from root
npm run build        # engine then app
npm run test         # engine then app
npm run format       # Biome auto-format all source files
```

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18, Vite 6, TanStack Router (file-based), Tailwind CSS v4, Radix UI / Shadcn, Red Hat Display/Text/Mono fonts |
| Design system | PatternFly 6 color palette, always-dark sidebar, Red Hat Display/Text/Mono typography |
| State | Zustand (board, chat, IDE, theme, sidebar, telemetry, recent, persona), TanStack Query (server data + caching) |
| Observability | OpenTelemetry SDK (metrics), console + OTLP/HTTP exporters (`src/lib/telemetry/`) |
| Drag-and-drop | @hello-pangea/dnd |
| Code editor | @monaco-editor/react (lazy-loaded on IDE route only) |
| GitHub API | Custom `GitHubClient` REST client (`src/lib/github/client.ts`) with `resilientFetch` |
| Jira API | Custom `JiraClient` REST client (`src/lib/jira/client.ts`) with `resilientFetch` |
| HTTP resilience | `resilientFetch` wrapper — exponential backoff, Retry-After, GET deduplication (`src/lib/fetch/`) |
| Linting | Biome v2.4 (lint + format), TypeScript strict mode (`tsc --noEmit`) |
| CI/CD | GitHub Actions: CI (validate+test+build), Publish (GitHub Pages), Release (tag-based) |
| WASM engine | Rust + wasm-pack + wasm-bindgen |
| JS sandbox | rquickjs (compiled into WASM) — stub, not yet integrated |
| TS transpile | oxc (compiled into WASM) — stub, not yet integrated |

## Architecture

### Three-Layer Browser Architecture

1. **React SPA** — routes: `/board/:id` (kanban + table view), `/issue/:key/chat` (issue chat), `/issue/:key/ide` (web IDE), `/chat` (general chat), `/search` (issue search), `/settings`, `/auth/callback` (OAuth)
2. **Service Worker** (`public/sw.js`) — handles auth token management (with expiry checking), Jira/GitHub API proxying with IndexedDB caching, MCP protocol, and LLM API relay
3. **WASM Engine** — hierarchy resolution, config parsing, tool aggregation, QuickJS sandbox, MCP protocol handler, and auth-based content filtering

### Data Flow

- Jira Cloud REST API v3 is the single source of truth for board/issue data — no local database
- The IDE uses a virtual filesystem backed by GitHub REST API (no repo cloning) with content-addressed caching (keyed by blob SHA)
- Git commits are atomic multi-file operations via GitHub's Git Data API (blobs → tree → commit → ref update)
- MCP content tools resolve instantly from the pre-built manifest cache in WASM; upstream tool execution routes through the Service Worker

### Auth Model

Three user classes with progressive auth (acquired lazily on first feature use):
- **Guest** — no auth, public content only
- **Outside Contributor** — GitHub OAuth, public + GitHub-gated content, own LLM API key
- **Red Hat Employee** — Red Hat SSO (OIDC), full access, Vertex AI via Google OAuth

Content visibility is tiered (`public` / `github` / `redhat-sso`) and filtered by the WASM engine at resolution time. Build pipeline generates layered manifests (`manifest-public.json`, `manifest-github.json`, `manifest-internal.json`).

OAuth connect buttons on the landing page and settings page are wired to the initiation functions. GitHub uses standard Authorization Code flow (no PKCE — GitHub OAuth Apps don't support it). Atlassian, Google, and Red Hat SSO use PKCE with S256. The `/auth/callback` route handles code exchange for all four providers. Provider configs are centralized in `src/lib/auth/config.ts`, reading from `.well-known/aegis-configuration` with `VITE_*` env var fallbacks.

OAuth state and PKCE verifiers are stored in `localStorage` (not `sessionStorage`) to survive the GitHub Pages 404.html SPA redirect. The callback URL includes `import.meta.env.BASE_URL` to work on subdirectory deployments.

GitHub and Google token exchanges require a `client_secret` which browsers can't hold securely. A **Cloudflare Worker** (`workers/github-oauth-proxy/`) proxies both exchanges, injecting the secrets from Cloudflare Worker environment variables. The worker URL is configured via `auth.githubTokenProxyUrl` in `.well-known/aegis-configuration`.

The Service Worker checks token expiry before injection (with 60s buffer), and API clients (Jira, GitHub) detect 401 responses and clear stale tokens to trigger re-auth UI. On app startup, `authManager.clearExpiredTokens()` proactively cleans expired metadata.

**Known limitation**: OAuth tokens live in Service Worker memory and are lost on page reload. Users must re-authenticate after a full page refresh. API key-based providers (OpenAI, Anthropic) are not affected since their keys persist in the SW via `sendTokenToSW()`.

### Deployment Configuration

Aegis uses a `.well-known` runtime config file for deployment-time settings that shouldn't require a rebuild:

```
public/.well-known/aegis-configuration
```

```json
{
  "telemetry": {
    "otlpEndpoint": "https://otel-collector.example.com/v1/metrics",
    "exportIntervalMs": 60000,
    "enabled": true
  },
  "auth": {
    "githubClientId": "your-github-app-id",
    "atlassianClientId": "your-atlassian-app-id",
    "rhSsoIssuerUrl": "https://sso.redhat.com/auth/realms/redhat-external",
    "rhSsoClientId": "your-rhsso-client-id",
    "googleClientId": "your-google-client-id",
    "githubTokenProxyUrl": "https://your-proxy.workers.dev"
  }
}
```

**Resolution order** (first non-null wins for each field):
1. User `localStorage` override (from Settings UI)
2. `.well-known/aegis-configuration` (deployer edits this file)
3. `VITE_*` environment variables (build-time)
4. Hardcoded defaults

The file is fetched asynchronously on app startup (`loadWellKnownConfig()` in `src/lib/telemetry/config.ts`) before the MeterProvider and auth configs are initialized. Both `getTelemetryConfig()` and `get*Config()` auth helpers read from it.

### LLM Provider Abstraction

All providers implement a common `LLMProvider` interface with `AsyncIterable<ChatChunk>` streaming. Five providers: Vertex AI (Claude), Anthropic direct, OpenAI, Ollama, and custom endpoints.

API keys are stored in the Service Worker's memory (not page JS). Provider `fetch()` calls route through `{BASE_URL}_aegis/llm/{provider}/...` — the SW rewrites URLs and injects auth headers. The relay URL includes `import.meta.env.BASE_URL` to work on subdirectory deployments (e.g., `/aegis/_aegis/llm/openai/...`). When a provider lacks tool use support, org context is inlined in the system prompt and tool-dependent features degrade gracefully.

All five providers pass `AbortSignal` to `fetch()` for stream cancellation (Escape key or Stop button). Chat errors are displayed as distinct UI banners (not inline markdown) with a Retry button. Provider switching mid-session uses the store's `switchProvider` action to preserve chat history.

Configured providers persist to `localStorage` via `useLLMConfigStore` (`src/stores/llm-config.ts`). On startup, `restoreProviders()` (`src/lib/llm/restore-providers.ts`) re-registers all saved providers before the React tree renders. This ensures the chat view can resolve its persisted `providerId` immediately.

### Jira API Proxy

Jira Cloud blocks browser CORS. Two auth paths: (1) Atlassian OAuth with cloudId-based URLs via Service Worker, or (2) API token auth routed through the Cloudflare Worker at `workers/github-oauth-proxy/` (route `/jira/*`). The worker forwards requests with Basic Auth credentials from `X-Jira-Auth` and adds CORS headers. Jira API token config persists in `useJiraConfigStore` (`src/stores/jira-config.ts`).

### WASM Engine Modules

The Rust engine (`packages/engine/src/`) contains modules ported from two existing projects:
- From **sdlc-mcp**: `hierarchy.rs` (scope resolution/merge), `config.rs` (YAML parsing)
- From **cmcp**: `catalog.rs` (tool aggregation), `sandbox.rs` (QuickJS sandbox)
- New: `mcp.rs` (protocol handler), `auth_filter.rs` (visibility filtering)

## Current Implementation Status

Phases 1–5 of the design are implemented. Phase 6 (Tool Aggregation with QuickJS sandbox) is not yet built.

| Feature | Status | Key Files |
|---|---|---|
| React SPA + routing | Done | `src/routes/`, `src/components/shared/` |
| WASM engine | Done | `packages/engine/src/` (hierarchy, auth filter, MCP, catalog) |
| Auth (4 OAuth flows) | Done | `src/lib/auth/` (GitHub, Atlassian, RH SSO, Google + PKCE) |
| Auth wiring (UI → OAuth) | Done | `src/routes/index.tsx`, `src/routes/settings.tsx`, `src/routes/auth.callback.tsx`, `src/lib/auth/config.ts` |
| Token expiry handling | Done | `public/sw.js` (expiry check), `src/lib/auth/manager.ts` (clearExpiredTokens), 401 detection in Jira/GitHub clients |
| Service Worker | Done | `public/sw.js` (caching, auth injection, token expiry, LLM relay) |
| Kanban Board | Done | `src/components/board/`, `src/lib/jira/`, `src/stores/board.ts` |
| AI Chat (5 providers) | Done | `src/components/chat/`, `src/lib/llm/`, `src/stores/chat.ts` |
| Chat session persistence | Done | `src/stores/chat.ts` — IndexedDB with providerId/currentModel, 7-day TTL, clear chat button |
| Chat error recovery | Done | Error banners with Retry button, structured error display (not inline markdown) |
| LLM provider persistence | Done | `src/stores/llm-config.ts`, `src/lib/llm/restore-providers.ts` — survives reload |
| Multi-provider dropdown | Done | `src/components/chat/ChatView.tsx` — all registered providers grouped in dropdown |
| Jira API token auth | Done | `src/stores/jira-config.ts` — alternative to OAuth, via Cloudflare Worker proxy |
| Web IDE + Monaco | Done | `src/components/ide/`, `src/lib/vfs/`, `src/lib/github/` |
| Landing (launchpad) | Done | `src/routes/index.tsx` — context-aware: recent issues grid + quick actions for auth users, auth CTA for guests |
| Settings (3 tabs) | Done | `src/routes/settings.tsx` — Integrations (auth + LLM), Preferences (theme + telemetry), About |
| Issue context bar | Done | `src/components/shared/IssueContextBar.tsx` — breadcrumbs + Chat/IDE view switcher on issue routes |
| Recent issues | Done | `src/stores/recent.ts` — tracks last 8 visited issues for launchpad |
| Keyboard shortcuts | Done | `src/lib/shortcuts/`, scoped (global/board/chat/ide), chord support |
| Command palette | Done | `src/lib/commands/`, `src/components/shared/CommandPalette.tsx` |
| Resilient fetch | Done | `src/lib/fetch/resilient-fetch.ts` |
| Empty states | Done | `src/components/shared/EmptyState.tsx` |
| Responsive layout | Done | Collapsible sidebar (hamburger on mobile), stacking board columns, responsive IDE panels |
| Accessibility (WCAG) | Done | Skip nav, page titles, ARIA roles/labels on all widgets, keyboard focus indicators |
| Theme management | Done | `src/stores/theme.ts` — single Zustand store, syncs Header/Settings/CmdK |
| Board table view | Done | `src/components/board/BoardTableView.tsx` — sortable table with kanban/table toggle |
| Board skeleton loading | Done | `src/components/board/BoardSkeleton.tsx` — animated placeholder columns while data loads |
| Persona/role system | Done | `src/stores/persona.ts` — 6 roles (Developer, PM, QA, Architect, Manager, Support). Role-aware AI prompts, landing widgets, system prompt |
| General chat | Done | `src/routes/chat.tsx` — non-issue-scoped chat with persona-aware prompts |
| Global search | Done | `src/routes/search.tsx` — issue search page (Jira integration placeholder) |
| Onboarding wizard | Built | `src/components/shared/OnboardingWizard.tsx` — exists but not yet triggered on first visit |
| User stories | Defined | `docs/user-stories.md` — 21 stories, 10 personas |
| OTEL metrics | Done | `src/lib/telemetry/` — HTTP, LLM, navigation, Web Vitals. Console + OTLP exporters. Settings UI |

## Testing

```bash
# JS tests (from packages/app/)
npm run test           # 313 tests across 25 suites

# Rust tests (from packages/engine/)
cargo test             # 37 tests across 6 modules
```

## Key Constraints

- Monaco is NOT VS Code — no terminal, debugger, or extensions. The IDE is scoped to focused, issue-scoped edits.
- Jira API rate limit is ~100 req/min — use aggressive caching (IndexedDB with TTLs), batch via JQL, stale-while-revalidate.
- GitHub API rate limit is 5,000 req/hr — rely on content-addressed caching and lazy file loading.
- Bundle size target: ~5-6MB total (Monaco ~3MB lazy-loaded, WASM ~1-2MB, React app ~200KB), code-split by route.
- Multi-repo issues get separate commits/PRs per repo — no cross-repo atomicity.

## CI/CD

Three GitHub Actions workflows in `.github/workflows/`:

**`ci.yml`** — runs on every PR and push to main:
- `validate`: TypeScript strict checking (`tsc --noEmit` — API contract enforcement) + Biome lint/format check
- `test-app`: 313 vitest tests (runs in parallel with validate)
- `test-engine`: 37 Rust/cargo tests (runs in parallel)
- `build`: full WASM + app production build (only runs after all validation passes)

**`publish.yml`** — deploys to GitHub Pages on push to main:
- Triggers when `packages/app/` or `packages/engine/` files change
- Builds full bundle (WASM engine → Vite app) and deploys via `actions/deploy-pages`
- Manual trigger via `workflow_dispatch`

**`release.yml`** — creates GitHub Release on tag push:
- Triggers on `v*` tags (e.g., `git tag v0.2.0 && git push --tags`)
- Runs full test suite, builds production bundle, packages as tarball
- Creates GitHub Release with auto-generated notes from commits

**Biome** (`biome.json`): Rust-based linter/formatter (v2.4). Enforces recommended lint rules, import organization, and consistent formatting. CI fails on lint violations or formatting drift. Run `npm run format` to auto-fix locally.

## Security

The threat model (`docs/security/threat-model.md`) documents 14 attack vectors analyzed via STRIDE. Three rounds of security audit (`docs/security/audit-{1,2,3}/`) resolved all critical and high-severity issues:

- **LLM relay hardening**: Custom and Vertex AI relay endpoints restricted to configured/validated URLs only
- **XSS prevention**: SafeLink component filters `javascript:`/`data:` URIs in all ReactMarkdown rendering; CSP meta tag restricts script sources (injected only in production builds via Vite plugin; dev mode has no CSP to allow HMR)
- **Prompt injection defense**: User-controlled content in LLM system prompts wrapped in `<user_content>` boundary tags
- **API security**: Error messages sanitized (no response body leakage); URL path parameters encoded
- **Token management**: SW checks token expiry before injection; 401 responses trigger token cleanup; expired metadata evicted on startup
- **Debug logging**: Guarded by `import.meta.env.DEV` — stripped in production builds
