# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aegis is a zero-infrastructure development platform served as a single WASM binary from a static site (GitHub Pages). It combines organizational context delivery, MCP tool aggregation, and an AI-native development surface (kanban board, AI chat, browser IDE) — all running entirely in the browser with no backend.

The design document lives at `docs/design.md`.

## Repository Structure

This is a monorepo with two packages:

- **`packages/app/`** — React SPA (Vite, TypeScript)
- **`packages/engine/`** — Rust WASM module (compiled via `wasm-pack`)
- **`config/`** — scope definitions (`scopes.yml`) and component-to-repo mapping (`components.yml`)

## Build Commands

```bash
# WASM engine (from packages/engine/)
cargo build --target wasm32-unknown-unknown
wasm-pack build

# React SPA (from packages/app/)
npm run dev          # dev server
npm run build        # production build (vite build)

# Full build (CI)
# See .github/workflows/build.yml — builds WASM, then SPA, then deploys to GitHub Pages
```

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18, Vite 7, TanStack Router, Tailwind CSS, Radix UI / Shadcn |
| State | Zustand (UI state), TanStack Query (server data + caching) |
| Drag-and-drop | @hello-pangea/dnd |
| Code editor | @monaco-editor/react (lazy-loaded on IDE route only) |
| GitHub API | octokit/rest |
| Jira API | fetch via Service Worker (no SDK) |
| WASM engine | Rust + wasm-pack + wasm-bindgen |
| JS sandbox | rquickjs (compiled into WASM) |
| TS transpile | oxc (compiled into WASM) |

## Architecture

### Three-Layer Browser Architecture

1. **React SPA** — routes: `/board/:id` (kanban), `/issue/:key/chat` (AI chat), `/issue/:key/ide` (web IDE), `/settings`
2. **Service Worker** (`public/sw.js`) — handles auth token management, Jira/GitHub API proxying with IndexedDB caching, MCP protocol, and LLM API relay
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

### LLM Provider Abstraction

All providers implement a common `LLMProvider` interface. When a provider lacks tool use support, sdlc-mcp content is inlined in the system prompt and tool-dependent features degrade gracefully.

### WASM Engine Modules

The Rust engine (`packages/engine/src/`) contains modules ported from two existing projects:
- From **sdlc-mcp**: `hierarchy.rs` (scope resolution/merge), `config.rs` (YAML parsing)
- From **cmcp**: `catalog.rs` (tool aggregation), `sandbox.rs` (QuickJS sandbox)
- New: `mcp.rs` (protocol handler), `auth_filter.rs` (visibility filtering)

## Implementation Phases

The project follows six phases: Foundation (SPA scaffold + auth + WASM) → Kanban Board → AI Chat → IDE Editor + VFS → IDE AI + Git → Tool Aggregation. See `docs/design.md` §14 for details.

## Key Constraints

- Monaco is NOT VS Code — no terminal, debugger, or extensions. The IDE is scoped to focused, issue-scoped edits.
- Jira API rate limit is ~100 req/min — use aggressive caching (IndexedDB with TTLs), batch via JQL, stale-while-revalidate.
- GitHub API rate limit is 5,000 req/hr — rely on content-addressed caching and lazy file loading.
- Bundle size target: ~5-6MB total (Monaco ~3MB lazy-loaded, WASM ~1-2MB, React app ~200KB), code-split by route.
- Multi-repo issues get separate commits/PRs per repo — no cross-repo atomicity.
