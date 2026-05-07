# Aegis

A zero-infrastructure development platform that runs entirely in your browser. Open a URL, connect your accounts, and start working — no servers, no Docker, no local toolchain required.

Aegis combines three tools that developers, PMs, QA engineers, and managers typically use separately:

- **Kanban Board** — Jira-backed boards with drag-and-drop status transitions and a sortable table view
- **AI Chat** — Context-aware conversations scoped to a Jira issue or freeform, with role-specific prompts for developers, PMs, QA, architects, managers, and support staff
- **Web IDE** — Browser-based code editor (Monaco) with file tree, branch management, commit, and PR creation via the GitHub API

Everything runs client-side. The app is served as static files from GitHub Pages. A Service Worker handles auth token storage, API proxying, and caching.

## Why This Exists

A developer picking up a Jira ticket today has to context-switch across 6+ tools: Jira for the ticket, Confluence for docs, Slack for team questions, a terminal for git, an IDE for code, a browser for AI help, and GitHub for the PR. Each transition loses context. The AI has no awareness of team standards. The IDE has no awareness of the ticket.

Aegis collapses all of this into one browser tab. The AI knows your issue, your team's coding standards, and your role. The IDE knows your ticket. The board knows your code.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Rust](https://rustup.rs/) (stable toolchain)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) v0.14+

### Run Locally (Development)

```bash
# Clone the repo
git clone https://github.com/tpouyer/aegis.git
cd aegis

# Install dependencies
npm install

# Start the dev server (React app only — hot reload)
npm run dev
```

The app opens at **http://localhost:5173**.

That's it for most development. The WASM engine is pre-built. If you need to modify Rust code:

```bash
# Build the WASM engine (only needed if you change packages/engine/)
npm run build:engine

# Run all tests (JS + Rust)
npm run test
```

### Run from GitHub Pages (Production)

The production app is hosted at the GitHub Pages URL for this repo. No installation needed — just open the URL in a browser.

To deploy your own instance:

1. Fork this repo
2. Edit `packages/app/public/.well-known/aegis-configuration` with your OAuth client IDs and OTLP endpoint
3. Enable GitHub Pages in repo settings (deploy from `gh-pages` branch or GitHub Actions)
4. Push — the app builds and deploys automatically

### Connect Your Accounts

On first visit you're a **Guest** with access to public content only. To unlock features:

1. Click **Connect GitHub** on the landing page (or go to Settings > Integrations)
2. Click **Connect to Jira** when you open the board
3. For Red Hat employees: Connect via **Red Hat SSO** for full access

Tokens are stored securely in the Service Worker — never in localStorage or page JavaScript.

### Choose Your Role

Go to **Settings > Preferences > Role** and select your role:

| Role | What adapts |
|------|------------|
| Developer | AI prompts focus on implementation, code quality, technical approach |
| Product Manager | AI prompts focus on scope, requirements, dependencies, stakeholder updates |
| QA | AI prompts focus on test cases, edge cases, regression risk |
| Architect | AI prompts focus on design patterns, coupling, scalability |
| Manager | AI prompts focus on blockers, progress, team capacity |
| Support | AI prompts focus on customer impact, workarounds, fix timelines |

Your role changes the AI's suggested prompts, system prompt context, and landing page widgets.

## Project Structure

```
aegis/
├── packages/
│   ├── app/                  # React SPA (Vite, TypeScript)
│   │   ├── src/
│   │   │   ├── routes/       # File-based routing (TanStack Router)
│   │   │   ├── components/   # UI components (board, chat, ide, shared, ui)
│   │   │   ├── stores/       # Zustand state (board, chat, ide, persona, theme, ...)
│   │   │   ├── lib/          # Core libraries (auth, jira, github, llm, vfs, telemetry)
│   │   │   └── app.css       # Design tokens (PatternFly 6 / Red Hat)
│   │   ├── public/
│   │   │   ├── sw.js         # Service Worker (auth, caching, LLM relay)
│   │   │   └── .well-known/  # Runtime deployment config
│   │   └── index.html
│   └── engine/               # Rust WASM module
│       └── src/              # Hierarchy resolution, config parsing, MCP protocol
├── config/                   # Scope definitions, component-to-repo mapping
├── workers/                  # Cloudflare Worker for OAuth token exchange proxy
├── .github/workflows/        # CI, Publish (GitHub Pages), Release workflows
├── docs/                     # Design doc, user stories, API reference, threat model, security audits
├── arch/                     # Architecture Decision Records (ADRs)
├── biome.json                # Biome linter/formatter config
└── CLAUDE.md                 # AI assistant context (detailed architecture for Claude Code)
```

## Key Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server at localhost:5173 |
| `npm run test` | Run all tests (313 JS + 37 Rust) |
| `npm run build` | Build WASM engine + production bundle |
| `npm run lint` | TypeScript type checking (API contract validation) |
| `npm run lint:biome` | Biome lint + format check |
| `npm run format` | Auto-format all source files with Biome |
| `npm run build:engine` | Rebuild WASM engine only |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open command palette |
| `?` | Show all keyboard shortcuts |
| `g b` | Go to board |
| `g s` | Go to settings |
| `Cmd+3` | Go to general chat |
| `j` / `k` | Navigate board cards |
| `f` | Focus board search |
| `Enter` | Open focused card detail |
| `Escape` | Close panel / stop streaming |

## Tech Stack

- **Frontend**: React 18, Vite 6, TanStack Router, Tailwind CSS v4
- **Design**: PatternFly 6 colors, Red Hat Display/Text/Mono fonts
- **State**: Zustand (8 stores) + TanStack Query
- **Components**: Radix UI / Shadcn (copy-paste, not dependency)
- **Editor**: Monaco (lazy-loaded)
- **Drag-and-drop**: @hello-pangea/dnd
- **Observability**: OpenTelemetry SDK (metrics)
- **WASM**: Rust + wasm-pack + wasm-bindgen
- **Auth**: OAuth 2.0 + PKCE for GitHub, Atlassian, Red Hat SSO, Google
- **Linting**: Biome v2.4 (lint + format)
- **CI/CD**: GitHub Actions (CI, Publish, Release)

## CI/CD

All pipelines are in `.github/workflows/`.

| Workflow | Triggers | What it does |
|----------|----------|-------------|
| **CI** (`ci.yml`) | PR + push to main | TypeScript type check, Biome lint, 313 JS tests, 37 Rust tests, production build |
| **Publish** (`publish.yml`) | Push to main | Builds and deploys to GitHub Pages |
| **Release** (`release.yml`) | Tag push (`v*`) | Runs tests, builds, creates GitHub Release with tarball |

### Creating a Release

```bash
git tag v0.2.0
git push --tags
```

The release workflow builds, tests, and creates a GitHub Release with auto-generated notes.

## Documentation

| Document | What it covers |
|----------|---------------|
| [Design Doc](docs/design.md) | Full architecture, data flow, phases |
| [User Stories](docs/user-stories.md) | 21 stories across 10 personas |
| [API Reference](docs/api-reference.md) | All TypeScript interfaces and contracts |
| [Threat Model](docs/security/threat-model.md) | 12 attack vectors, STRIDE analysis |
| [CLAUDE.md](CLAUDE.md) | AI-oriented architecture reference |
| [ADRs](arch/) | Architecture decision records |

## License

TBD
