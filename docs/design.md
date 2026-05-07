# Aegis — Design Document

> *Zeus's shield, carried by Athena — the goddess of strategy, not brute force. Your organizational context is the aegis that turns a generic AI into YOUR team's AI.*

## 1. Vision

Aegis is a zero-infrastructure development platform served as a single WASM binary from a static site. It unifies three capabilities that today require separate tools, separate auth, and separate context:

1. **Organizational context delivery** — hierarchical, scope-aware knowledge (coding standards, architecture docs, security checklists) resolved per-repo and served to both humans and AI agents
2. **Tool aggregation** — a proxy that consolidates upstream MCP servers (GitHub, Jira, Confluence, Slack) behind a 2-tool discovery/execution interface, eliminating context window bloat
3. **AI-native development surface** — a kanban board backed by Jira, an AI chat interface, and a browser-based IDE with AI-assisted editing, branching, and PR submission

The entire platform runs in the browser. No server to operate. No Docker. No local toolchain. A developer opens a URL, authenticates, and starts working.

---

## 2. Problem Statement

A developer picking up a Jira ticket today must:

1. Open Jira to read the ticket
2. Open Confluence to find the relevant design doc
3. Open Slack to ask the team about conventions
4. Open a terminal to clone the repo
5. Open an IDE to write code
6. Open a browser to ask an AI chatbot for help (without any org context)
7. Open GitHub to create a PR
8. Go back to Jira to transition the ticket

Each transition loses context. The AI has no awareness of team standards. The IDE has no awareness of the ticket. The ticket has no awareness of the code. Aegis collapses all of this into one browser tab.

---

## 3. Architecture

### 3.1 High-Level

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Static Host (GitHub Pages)                                             │
│                                                                         │
│  index.html        — SPA shell                                          │
│  aegis-app.js      — React application (code-split by route)            │
│  aegis-engine.wasm — Context engine + tool proxy (Rust → WASM)          │
│  manifest.json     — Pre-built content index + tool catalog             │
│  sw.js             — Service Worker (auth, caching, MCP protocol)       │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                     User opens in browser
                                    │
┌───────────────────────────────────┴─────────────────────────────────────┐
│  Browser                                                                │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  React SPA                                                         │ │
│  │                                                                    │ │
│  │  /board/:id     — Kanban board + table view (Jira-backed)           │ │
│  │  /issue/:key/chat — Issue-scoped AI chat                           │ │
│  │  /issue/:key/ide  — Web IDE (Monaco + Git)                         │ │
│  │  /chat            — General AI chat (non-issue-scoped)             │ │
│  │  /search          — Global issue search                            │ │
│  │  /settings        — Integrations, Preferences, About               │ │
│  │  /auth/callback   — OAuth code exchange handler                    │ │
│  └──────────────────────────┬─────────────────────────────────────────┘ │
│                             │                                           │
│  ┌──────────────────────────┴─────────────────────────────────────────┐ │
│  │  Service Worker                                                    │ │
│  │                                                                    │ │
│  │  ┌──────────────┐  ┌────────────┐  ┌──────────┐  ┌─────────────┐  │ │
│  │  │ WASM Engine  │  │ Jira Cache │  │ GitHub   │  │ Auth Mgr    │  │ │
│  │  │ - hierarchy  │  │ - boards   │  │ Cache    │  │ - RH SSO    │  │ │
│  │  │ - merge      │  │ - issues   │  │ - trees  │  │ - GitHub    │  │ │
│  │  │ - tool proxy │  │ - statuses │  │ - files  │  │ - Atlassian │  │ │
│  │  │ - MCP proto  │  │ - users    │  │ - diffs  │  │ - Google    │  │ │
│  │  └──────────────┘  └────────────┘  └──────────┘  └─────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│         │                  │               │               │            │
└─────────┼──────────────────┼───────────────┼───────────────┼────────────┘
          │                  │               │               │
          ▼                  ▼               ▼               ▼
   GitHub Pages         Jira Cloud      GitHub API      LLM Provider
   (content)            REST v3         REST v3         (Vertex/Anthropic/
                                                         Ollama/etc.)
```

### 3.2 The WASM Engine

A Rust binary compiled to WASM via `wasm-pack`. Contains:

| Module | Origin | Purpose |
|---|---|---|
| `hierarchy` | sdlc-mcp | Scope filtering, "most specific wins" merge |
| `config` | sdlc-mcp | YAML config parsing, include resolution |
| `catalog` | cmcp | Tool aggregation, TypeScript type generation |
| `sandbox` | cmcp | QuickJS sandbox for search/execute |
| `mcp` | new | MCP protocol handler (tools/list, tools/call) |
| `auth_filter` | new | Content visibility filtering by auth level |

The engine is initialized with the pre-built `manifest.json` and runs entirely in-browser. Content tools resolve from cache (instant). Tool execution routes through the Service Worker to upstream MCP servers.

### 3.3 Service Worker Responsibilities

```
1. Static asset caching (SPA shell, WASM binary, manifest)
2. Auth token management (store, refresh, inject into requests)
3. Jira API proxy + cache (IndexedDB, TTL-based)
4. GitHub API proxy + cache (content-addressed by SHA)
5. MCP protocol handler (for external MCP clients connecting to Aegis)
6. LLM API relay (injects auth, routes to correct provider)
```

---

## 4. User Classes and Auth

### 4.1 Three User Classes

| Class | Identity | Auth Method | Access Level |
|---|---|---|---|
| **Guest** | Anonymous | None | Public content only (contribution guides, coding standards) |
| **Outside Contributor** | GitHub user | GitHub OAuth (ansible org) | Public + GitHub-gated content, public Jira issues, IDE, AI (own provider) |
| **Red Hat Employee** | Red Hat associate | Red Hat SSO (OIDC) | Everything including confidential Jira issues, internal docs, AI via Vertex |

### 4.2 Auth Federation Map

```
Red Hat SSO (primary identity for RH employees)
  │
  ├── federated to ──▶ Atlassian Cloud (Jira)
  │                     - Full access including confidential issues
  │                     - Outside contributors can also auth directly
  │                       to Atlassian (see public issues only)
  │
  ├── federated to ──▶ GitHub (ansible-automation-platform org ONLY)
  │                     - ansible org still requires separate GitHub OAuth
  │                     - Outside contributors use GitHub OAuth directly
  │
  └── NOT federated ──▶ Google Cloud (Vertex AI)
                         - Separate Google OAuth required
                         - RH employees have Google Workspace accounts
                         - Triggered on first AI feature use
```

### 4.3 Progressive Auth

Auth is acquired lazily — only when the user accesses a feature that requires it:

```
Action                      Auth Required              Trigger Point
──────────────────────────────────────────────────────────────────────
Browse public docs          None                       Immediate
View kanban board           Jira (SSO or Atlassian)    First board open
Drag/transition card        Jira write scope           First mutation
Open IDE                    GitHub OAuth               First IDE open
Commit / create PR          GitHub OAuth (repo scope)  First commit
AI Chat (RH employee)       Google OAuth (Vertex)      First AI use
AI Chat (contributor)       Own API key configured     First AI use
```

### 4.4 Content Visibility Tiers

sdlc-mcp config scopes gain a `visibility` field:

```yaml
- name: ansible-community
  visibility: public          # no auth required
  sources:
    - type: git
      url: https://github.com/ansible/community-docs
      path: standards/

- name: ansible-platform
  visibility: github          # requires GitHub auth
  repos: [awx, receptor, eda-server]
  sources:
    - type: git
      url: https://github.com/ansible/awx
      path: docs/dev/

- name: aap-internal
  visibility: redhat-sso      # requires Red Hat SSO
  sources:
    - type: git
      url: https://github.com/ansible-automation-platform/internal-docs
      path: architecture/
```

The WASM engine filters at resolution time:

```
resolve_hierarchy(repo, auth_level):
  anonymous   → only "public" scopes
  github      → "public" + "github" scopes
  redhat-sso  → "public" + "github" + "redhat-sso" scopes
```

Build pipeline generates layered manifests:

```
site/
  manifest-public.json      # public content — no auth to fetch
  manifest-github.json      # public + github-gated
  manifest-internal.json    # everything — behind aap org GitHub Pages auth
```

---

## 5. Feature: Kanban Board

### 5.1 Data Source

Jira Cloud REST API v3 is the single source of truth. No local database.

### 5.2 Jira → Board Mapping

| Jira Concept | Board View | Rendering |
|---|---|---|
| Board + Filter | Team Kanban | Columns = board column config; cards = issues matching board filter |
| Assignee = currentUser | "My Work" | Personal board filtered to logged-in user |
| Component | Component Board | Issues filtered by Jira component |
| Fix Version | Release Board | Issues grouped by target release |
| Sprint | Sprint Board | Active sprint issues with backlog toggle |
| Label / Custom Field | Workstream Board | Filter by label or custom field value |
| Epic | Epic Board | Stories/tasks under an epic |

### 5.3 Card Actions

Each issue card displays two action buttons:

```
┌──────────────────────────────────────────┐
│  AAP-1234                          ●High │
│  Add PATCH endpoint for job        ───── │
│  template labels                         │
│                                          │
│  ┌──────┐  awx  api-gateway        TP   │
│  │ 3 SP │                                │
│  └──────┘                                │
│                                          │
│  [✦ AI Chat]              [⟨/⟩ Open IDE] │
└──────────────────────────────────────────┘
```

- **[AI Chat]** — opens `/issue/AAP-1234/chat`
- **[Open IDE]** — opens `/issue/AAP-1234/ide`

### 5.4 Drag-and-Drop Transitions

Uses `@hello-pangea/dnd`. On card drag:

1. Optimistic UI update via Zustand
2. Fetch available transitions: `GET /rest/api/3/issue/{key}/transitions`
3. Find transition matching target status
4. If transition requires fields → show modal before completing
5. Execute transition: `POST /rest/api/3/issue/{key}/transitions`
6. On failure → rollback optimistic update with error toast

### 5.5 Jira Caching Strategy

```
Layer 1: IndexedDB (persistent)
  - Board configurations          TTL: 1 hour
  - Workflow/status metadata      TTL: 24 hours
  - User/team/component lists     TTL: 1 hour
  - Issue snapshots               TTL: 60 seconds

Layer 2: In-memory (session)
  - Active board issues           Refreshed on window focus
  - Optimistic mutation queue     Drained on API response
  - Pending transitions           Cleared on completion

Layer 3: GitHub Pages (build-time)
  - sdlc-mcp content              TTL: until next build
  - Upstream tool catalog          TTL: until next build
```

### 5.6 Jira Issue Security

Jira's REST API enforces security levels based on the authenticated user's token. Confidential issues are simply not returned for outside contributors — no client-side filtering needed. The board renders what Jira returns.

---

## 6. Feature: AI Chat Session

### 6.1 User Flow

1. User clicks **[AI Chat]** on a card
2. Chat view loads with pre-assembled context:
   - Issue details (summary, description, acceptance criteria) from Jira
   - Linked issues and subtasks from Jira
   - Org context (coding standards, testing guidelines, architecture) from WASM engine, resolved for the issue's component/repo
3. User types a prompt; AI responds with full awareness of the issue AND the team's conventions
4. AI can call MCP tools: content tools (instant, from cache), upstream tools (live, via Service Worker)
5. Chat history persists in IndexedDB per issue

### 6.2 System Prompt Assembly

```typescript
function buildSystemPrompt(
  issue: JiraIssue,
  orgContext: ResolvedContent[],
  provider: LLMProvider,
): string {
  let prompt = `You are an AI assistant helping with ${issue.key}: ${issue.summary}\n\n`;
  prompt += `## Issue\n${issue.description}\n\n`;

  if (issue.acceptanceCriteria) {
    prompt += `## Acceptance Criteria\n${issue.acceptanceCriteria}\n\n`;
  }

  if (!provider.supportsToolUse) {
    // Inline org context for models without tool use
    for (const content of orgContext) {
      prompt += `## ${content.name}\n${content.body}\n\n`;
    }
  }

  return prompt;
}
```

### 6.3 Tool Execution Flow

```
User prompt → LLM Provider
  ↓
AI decides to call a tool
  ↓
Tool router:
  Content tool (coding_standards, etc.)
    → WASM engine resolves from manifest cache
    → Instant, no network
  
  search() / execute()
    → WASM QuickJS sandbox
    → Upstream MCP server via Service Worker
    → Network call with appropriate auth
  
  Jira tool (issue_detail, transition, etc.)
    → Service Worker → Jira REST API
    → Cached where appropriate
  
Tool result → fed back to LLM for continuation
```

---

## 7. Feature: Web IDE

### 7.1 User Flow

1. User clicks **[Open IDE]** on a card
2. IDE reads the issue's component field from Jira
3. Maps component → GitHub repository via manifest config (with Jira custom field override)
4. Creates branch `feature/{issueKey}-{slug}` if it doesn't exist (via GitHub API)
5. Fetches repo file tree via `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`
6. Presents three-panel layout: File Explorer | Monaco Editor | AI Chat

### 7.2 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Aegis IDE — AAP-1234: Add PATCH endpoint for labels                │
│  Branch: feature/AAP-1234-add-label-endpoint  Base: main            │
├──────────┬──────────────────────────────────────┬───────────────────┤
│ Explorer │  job_templates.py  ×  test_labels.py │  AI Assistant     │
│          │                                      │                   │
│ ▼ awx    │  1  from rest_framework import ...   │  Issue: AAP-1234  │
│   ▼ api  │  2  from awx.api.models import ...   │  Add PATCH end-   │
│     ▼ v  │  3                                   │  point for job    │
│       jo…│  4  class JobTemplateLabelViewSet(    │  template labels  │
│       se…│  5      ModelViewSet):                │                   │
│     ▼ te │  6      serializer_class = ...        │  Context: coding  │
│       te…│  7                                   │  standards (plat- │
│   ▼ docs │  8      def partial_update(self, ..  │  form-team)       │
│          │  9          """PATCH handler."""       │                   │
│ ▼ recep  │ 10          ...                       │ ─────────────────│
│   ▼ pkg  │                                      │                   │
│          │                                      │  You: create a    │
│          │                                      │  test file for    │
│          │                                      │  this endpoint    │
│          │                                      │                   │
│          │                                      │  AI: I'll create  │
│          │                                      │  test_labels.py   │
│          │                                      │  following your   │
│          │                                      │  team's testing   │
│          │                                      │  guidelines...    │
│          │                                      │                   │
│          │                                      │  [Apply] [Copy]   │
│          │                                      │                   │
│          │                                      │  [______________] │
│          │                                      │  [Send]           │
├──────────┴──────────────────────────────────────┴───────────────────┤
│  Source Control                                        [Create PR]  │
│  Changes (2):  M api/views/job_templates.py                         │
│                A api/tests/test_labels.py                           │
│  Commit message: [Add label PATCH endpoint and tests___] [Commit]   │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 Virtual Filesystem

The IDE does NOT clone repos. It uses a virtual filesystem backed by GitHub's REST API, identical to github.dev's approach:

```typescript
interface VirtualFileSystem {
  // Tree operations (cached in IndexedDB, keyed by repo+ref)
  getTree(repo: string, ref: string): Promise<TreeEntry[]>;
  
  // File operations (cached by SHA — immutable content addressing)
  readFile(repo: string, path: string, ref: string): Promise<string>;
  
  // Write operations (local only until commit)
  writeFile(repo: string, path: string, content: string): void;
  deleteFile(repo: string, path: string): void;
  
  // Change tracking
  getChanges(): FileChange[];
  getDiff(repo: string, path: string): DiffResult;
}
```

**GitHub API calls:**

| Operation | Endpoint | When |
|---|---|---|
| Load file tree | `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` | IDE open (1 call per repo) |
| Read file | `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` | File click (1 call, cached by SHA) |
| Create branch | `POST /repos/{owner}/{repo}/git/refs` | IDE open if branch doesn't exist |
| Atomic commit | `POST .../git/blobs` + `POST .../git/trees` + `POST .../git/commits` + `PATCH .../git/refs` | User clicks Commit |
| Create PR | `POST /repos/{owner}/{repo}/pulls` | User clicks Create PR |

### 7.4 Component → Repository Mapping

```yaml
# In manifest config (build-time)
component_repos:
  "API":
    - { org: "ansible", repo: "awx", path: "awx/api/" }
  "UI":
    - { org: "ansible", repo: "awx", path: "awx/ui/" }
  "Receptor":
    - { org: "ansible", repo: "receptor" }
  "EDA":
    - { org: "ansible", repo: "eda-server" }

# Override via Jira custom field "repository" on individual issues:
#   "ansible/awx, ansible/receptor"  (comma-separated for multi-repo)
```

### 7.5 Monaco Editor Configuration

```typescript
// @monaco-editor/react — zero-config wrapper
// Features enabled:
//   - Multi-tab (each open file is a separate Monaco model)
//   - Diff view (toggle to compare against base branch)
//   - Language auto-detection from file extension
//   - Minimap, bracket matching, word wrap
//   - Read-only mode for files not explicitly opened for editing

// Key constraint: Monaco is NOT VS Code.
// Missing: terminal, debugger, extensions, integrated git.
// Aegis builds git and AI on top; terminal and debugger are out of scope.
// The IDE is for focused, issue-scoped edits — not a full dev environment.
```

### 7.6 AI Chat in IDE

The IDE's AI panel extends the standalone AI chat with file-aware tools:

```
IDE-specific tools (implemented in the React app):
  read_file(repo, path)            → returns file from VirtualFileSystem
  write_file(repo, path, content)  → writes to VFS (user confirms via diff)
  list_files(repo, path?, pattern?) → lists files matching a glob
  search_in_files(repo, query)     → text search across cached files
  get_current_changes()            → returns uncommitted modifications
  get_issue_context()              → returns Jira issue + org context

Standard MCP tools (from WASM engine):
  coding_standards(repo)           → team conventions
  testing_guidelines(repo)         → test requirements  
  search(code)                     → discover upstream tools
  execute(code)                    → invoke upstream tools
```

**Apply flow:**

1. AI generates code in response
2. Code block renders with **[Apply]** button
3. User clicks Apply → diff view shows proposed changes
4. User accepts → VirtualFileSystem updated, file appears in Changes panel
5. User can undo (Ctrl+Z reverts the model state)

### 7.7 Git Operations

**Commit (multi-file, atomic):**

```
User clicks [Commit]
  │
  ├─ 1. For each changed file:
  │     POST /repos/{owner}/{repo}/git/blobs
  │     { "content": base64, "encoding": "base64" }
  │     → returns blob SHA
  │
  ├─ 2. Build new tree:
  │     POST /repos/{owner}/{repo}/git/trees
  │     { "base_tree": currentTreeSHA,
  │       "tree": [{ "path": "...", "sha": blobSHA, "mode": "100644" }, ...] }
  │     → returns tree SHA
  │
  ├─ 3. Create commit:
  │     POST /repos/{owner}/{repo}/git/commits
  │     { "message": "...", "tree": treeSHA, "parents": [currentCommitSHA] }
  │     → returns commit SHA
  │
  └─ 4. Update branch ref:
       PATCH /repos/{owner}/{repo}/git/refs/heads/feature/AAP-1234
       { "sha": commitSHA }
```

**Create PR:**

```
User clicks [Create PR]
  │
  ├─ Pre-populated form:
  │   Title: "AAP-1234: {issue summary}"
  │   Body: auto-generated from commits + issue description
  │   Base: main
  │   Head: feature/AAP-1234-{slug}
  │   Includes Jira link in body
  │
  ├─ Optional: [Auto-generate description with AI]
  │   → AI summarizes the diff + issue context into a PR description
  │
  ├─ POST /repos/{owner}/{repo}/pulls
  │
  └─ Post-PR actions:
     - Transition Jira issue to "In Review" (if configured)
     - Add Jira comment with PR link
     - Jira auto-detects issue key in branch name for dev panel linking
```

**Multi-repo constraint:** If an issue spans two repos (e.g., awx + receptor), commits and PRs are per-repo. The Source Control panel groups changes by repo with separate Commit/PR buttons for each.

---

## 8. LLM Provider Architecture

### 8.1 Provider Abstraction

```typescript
interface LLMProvider {
  id: string;
  name: string;
  models: ModelInfo[];
  supportsToolUse: boolean;
  supportsStreaming: boolean;
  maxContextWindow: number;
  
  chat(params: ChatParams): AsyncIterable<ChatChunk>;
}
```

### 8.2 Provider Matrix

| Provider | Auth | Tool Use | Who Uses It |
|---|---|---|---|
| **Vertex AI (Claude)** | Google OAuth | Full | Red Hat employees (mandatory) |
| **Anthropic Direct** | API key (user's) | Full | Outside contributors (opt-in) |
| **OpenAI** | API key (user's) | Full | Outside contributors (opt-in) |
| **Ollama** | None (localhost) | Limited | Outside contributors (free, local) |
| **OpenRouter** | API key (user's) | Varies | Outside contributors (multi-model) |
| **Custom endpoint** | API key (optional) | Varies | Self-hosted / enterprise |

### 8.3 Vertex AI Flow (Red Hat Employees)

```
RH employee clicks [AI Chat]
  → App checks for Google OAuth token
  → If missing: initiate Google OAuth (Auth Code + PKCE)
     Scopes: https://www.googleapis.com/auth/cloud-platform
     User signs in with Red Hat Google Workspace account
  → Token stored in Service Worker
  
API call:
  POST https://{REGION}-aiplatform.googleapis.com/v1/
    projects/{PROJECT_ID}/locations/{REGION}/
    publishers/anthropic/models/{MODEL}:streamRawPredict
  
  Headers:
    Authorization: Bearer {google_oauth_token}
  
  Body: (standard Anthropic Messages API format)
    { "anthropic_version": "vertex-2023-10-16",
      "messages": [...], "max_tokens": 4096, "stream": true }

GCP project ID and region are embedded in the build-time manifest
(not secrets — the OAuth token provides authorization).
```

### 8.4 Tool Use Degradation

When a provider doesn't support tool use:

- sdlc-mcp content is embedded in the system prompt (not served via tools)
- `search()` / `execute()` proxy tools are unavailable
- IDE file tools fall back to prompt-based context injection
- UI shows capability indicator: "Full AI features" vs "Chat only"

### 8.5 Outside Contributor LLM Setup

First-time AI use shows a provider picker:

- Anthropic (Claude) — paste API key
- OpenAI — paste API key
- Ollama (local, free) — enter localhost endpoint
- OpenRouter / Together AI — paste API key
- Custom OpenAI-compatible endpoint — enter URL + optional key

API keys stored in Service Worker scope (origin-isolated, not accessible to page JS). Keys sent directly to provider — never through Aegis infrastructure.

---

## 9. Build Pipeline

```
GitHub Actions (on push to content repos + scheduled daily)
  │
  ├─ 1. Parse config
  │     Read YAML scopes, resolve includes (file://, github://)
  │
  ├─ 2. Fetch content
  │     Clone all git sources (depth=1)
  │     Read markdown files, extract frontmatter
  │     Classify by visibility tier (public / github / redhat-sso)
  │
  ├─ 3. Query upstream MCP servers
  │     Call tools/list on each configured upstream
  │     Cache tool schemas as JSON
  │     Generate TypeScript type declarations
  │
  ├─ 4. Build manifests
  │     manifest-public.json   — public content only
  │     manifest-github.json   — public + github-gated
  │     manifest-internal.json — everything
  │     Each includes: content artifacts, tool catalog, hierarchy index
  │
  ├─ 5. Compile WASM
  │     cargo build --target wasm32-unknown-unknown
  │     wasm-opt for size optimization (~1-2MB)
  │
  ├─ 6. Build React SPA
  │     vite build (code-split: board, chat, IDE are separate chunks)
  │     Monaco Editor loaded lazily (only on IDE route)
  │
  └─ 7. Deploy to GitHub Pages
       Push to gh-pages branch
       Static site with: SPA + WASM + manifests + SW
```

---

## 10. Technology Stack

| Component | Library | Rationale |
|---|---|---|
| **UI framework** | React 18 | Largest ecosystem, proven patterns from vibe-kanban |
| **Build tool** | Vite 6 | Fast builds, native code-splitting |
| **State** | Zustand + TanStack Query | Zustand for UI state, Query for server data + caching |
| **Routing** | TanStack Router | Type-safe, route-level code splitting |
| **Styling** | Tailwind CSS | Utility-first, matches vibe-kanban patterns |
| **Components** | Radix UI + Shadcn | Accessible primitives, consistent design system |
| **Drag-and-drop** | @hello-pangea/dnd | Proven in vibe-kanban, maintained react-beautiful-dnd fork |
| **Code editor** | @monaco-editor/react | Zero-config Monaco wrapper |
| **Markdown** | react-markdown + rehype | AI response rendering, issue descriptions |
| **Chat streaming** | fetch + ReadableStream | SSE parsing for all LLM providers |
| **GitHub API** | Custom GitHubClient + resilientFetch | Direct REST calls with retry, backoff, GET deduplication |
| **Jira API** | Custom JiraClient + resilientFetch | Direct REST calls with retry, backoff, rate-limit awareness |
| **Icons** | Lucide React | Tree-shakeable, consistent |
| **WASM engine** | Rust + wasm-pack + wasm-bindgen | Compiles hierarchy engine + QuickJS sandbox |
| **JS sandbox** | rquickjs (in WASM) | Agent TypeScript execution for search/execute |
| **TS transpile** | oxc (in WASM) | Fast TypeScript → JS for sandbox |

---

## 11. MCP Tools Exposed

The unified MCP server exposes these tools to external MCP clients (Claude Desktop, CLI agents, etc.):

```
Content tools (from sdlc-mcp, one per markdown artifact):
  coding_standards(repo?)        → team coding conventions
  testing_guidelines(repo?)      → test requirements and patterns
  architecture(repo?)            → architecture decision records
  security_policy(repo?)         → security review checklist
  onboarding(repo?)              → new developer guide
  ...                            → auto-generated from content frontmatter

Aggregation tools (from cmcp):
  search(code, max_length?)      → discover tools across upstream servers
  execute(code, max_length?)     → invoke tools via TypeScript in sandbox

Board tools (new):
  board_view(board_id, filters?) → board state as structured JSON
  issue_detail(issue_key)        → full issue with org context
  transition_issue(key, status)  → move issue on board
  update_issue(key, fields)      → update issue fields
  add_comment(key, body)         → add issue comment
```

---

## 12. Strengths

1. **Zero infrastructure** — GitHub Pages + WASM + Service Worker. No servers, no containers, no databases.

2. **Jira as single source of truth** — no data duplication, no sync drift. PMs and developers share the same system.

3. **Context-aware AI** — the AI knows your team's conventions, the issue requirements, and the repo architecture. Not a generic chatbot.

4. **Open-source friendly** — public content without auth, full IDE for anyone with a GitHub account and their own LLM key. Outside contributors aren't second-class citizens.

5. **Progressive complexity** — guest browses docs → contributor uses board + IDE → employee gets full AI via Vertex. Each tier adds capabilities without requiring the others.

6. **Branch/PR hygiene by design** — naming conventions, Jira linking, and transitions are baked into the workflow, not documented in a wiki.

7. **Offline capability** — content tools, board state, and cached files work without network. Only mutations and AI require connectivity.

8. **Universal deployment** — same WASM binary runs in browser, Cloudflare Workers, Deno, Node, or embedded in desktop apps.

---

## 13. Risks and Mitigations

### 13.1 Jira API Rate Limits
**Risk:** Jira Cloud allows ~100 req/min for OAuth apps. Heavy board use + issue detail fetches could hit limits.
**Mitigation:** Aggressive caching (IndexedDB with TTLs), batch requests via JQL search (100 issues/call), debounced refreshes, stale-while-revalidate pattern.

### 13.2 Jira Workflow Transition Complexity
**Risk:** Drag-and-drop triggers transitions that may require fields, validators, screens. Not a simple status update.
**Mitigation:** Pre-fetch available transitions per issue (cached). Show modal for required fields. Validate before executing. Rollback optimistic UI on failure.

### 13.3 GitHub API Rate Limits for IDE
**Risk:** 5,000 req/hour authenticated. Large repo tree browsing could burn through file reads.
**Mitigation:** Content-addressed caching (file content keyed by blob SHA — never stale). Lazy file loading (only fetch when opened). Tree fetch is a single API call per repo.

### 13.4 Multi-Repo Atomic Commits
**Risk:** Issues spanning multiple repos cannot be committed atomically. Changes to awx and receptor are separate commits/PRs.
**Mitigation:** UI groups changes by repo with separate commit/PR controls. Document this constraint. Consider a "Submit All" that creates PRs sequentially with cross-references.

### 13.5 Monaco Is Not VS Code
**Risk:** Developers expect terminal, debugger, extensions. Monaco provides none of these.
**Mitigation:** Position Aegis IDE for focused, issue-scoped edits — not as a full dev environment replacement. The AI chat compensates for missing terminal (explain commands) and debugger (analyze code paths). Link to "Open in VS Code" for complex work.

### 13.6 Four OAuth Flows
**Risk:** Red Hat employees may encounter up to 4 auth prompts: SSO, Atlassian (federated), GitHub (ansible org), Google (Vertex).
**Mitigation:** Progressive auth — only prompt when the feature is used. SSO → Atlassian is federated (seamless). Tokens cached across sessions. Offer a "Connect all accounts" onboarding wizard for one-time setup.

### 13.7 Vertex AI CORS
**Risk:** Google Vertex AI may not support browser-origin requests.
**Mitigation:** Test early. If blocked, deploy a thin Cloudflare Worker or Cloud Run proxy that verifies the Google OAuth token and relays to Vertex. ~30 lines of code.

### 13.8 LLM Provider Quality Disparity
**Risk:** Llama 3 via Ollama gives a dramatically different experience than Claude Opus via Vertex.
**Mitigation:** Show capability matrix in provider picker. Recommend models with function calling (DeepSeek Coder V2, Qwen 2.5 Coder) for best open-source experience. Degrade gracefully — chat still works, tools are optional.

### 13.9 API Key Security
**Risk:** Outside contributors paste API keys into the browser. XSS or malicious extensions could exfiltrate them.
**Mitigation:** Store in Service Worker scope (not localStorage). CSP headers restrict connect-src to known endpoints. Keys never appear in page JavaScript. Document risk; recommend keys with spending limits.

### 13.10 Bundle Size
**Risk:** Monaco (~3MB) + React app (~200KB) + WASM engine (~1-2MB) = ~5-6MB initial load.
**Mitigation:** Code-split by route (Monaco only loads on /ide). Service Worker precaches for instant return visits. Comparable to github.dev (~8MB).

---

## 14. Implementation Phases

### Phase 1: Foundation
- React SPA scaffold (Vite, TanStack Router, Tailwind, Shadcn)
- Service Worker with auth manager (Red Hat SSO, GitHub OAuth, Atlassian OAuth)
- WASM engine compiled and loaded (hierarchy resolution + content merge)
- GitHub Pages deployment via GitHub Actions
- Landing page with auth flows

### Phase 2: Kanban Board
- Jira API integration (boards, issues, statuses, users)
- Board view with columns, cards, drag-and-drop transitions
- Issue detail panel with context sidebar (sdlc-mcp content from WASM)
- Jira caching layer in Service Worker
- [AI Chat] and [Open IDE] buttons visible on cards

### Phase 3: AI Chat
- LLM provider abstraction (Vertex, Anthropic, OpenAI, Ollama, custom)
- Provider picker UI for outside contributors
- Chat interface with streaming responses and markdown rendering
- System prompt assembly (issue + org context)
- Tool execution through WASM engine
- Chat session persistence in IndexedDB

### Phase 4: Web IDE — Editor + File System
- Virtual filesystem backed by GitHub API
- File explorer (tree view, multi-repo)
- Monaco editor (multi-tab, diff view, language detection)
- Branch creation from issue key
- Component → repo mapping

### Phase 5: Web IDE — AI + Git
- AI chat panel in IDE with file-aware tools
- Apply/diff flow for AI-generated code
- Commit UI (multi-file atomic via Git Data API)
- PR creation with auto-populated fields
- Jira transition on PR creation

### Phase 6: Tool Aggregation
- cmcp-style upstream MCP server pool
- search() / execute() tools with QuickJS sandbox
- Build pipeline: query upstream servers, cache catalogs
- TypeScript type generation for upstream tools

---

## 15. File Structure

```
aegis/
  docs/
    design.md              ← this document
  arch/
    001-monorepo-structure.md  ← ADRs
    ...
    reviews/               ← adversarial review findings
    enhancements/          ← PM proposals, votes, cycle summaries
  packages/
    app/                   ← React SPA
      src/
        routes/            ← TanStack Router file-based routes
          __root.tsx       ← root layout (sidebar, header, toaster, command palette)
          index.tsx        ← landing page
          board.$boardId.tsx    ← kanban board
          issue.$issueKey.chat.tsx  ← AI chat
          issue.$issueKey.ide.tsx   ← web IDE
          settings.tsx     ← auth connections, LLM config, theme
        components/
          board/           ← BoardView, Column, Card, CardDetail, FilterBar, TransitionModal
          chat/            ← ChatView, MessageList, MessageInput, ToolResult, ProviderPicker
          ide/             ← IDELayout, MonacoEditor, MonacoDiffView, FileExplorer, EditorTabs, SourceControl, ApplyBlock, DiffView
          shared/          ← Header, Sidebar, Toaster, ErrorBoundary, Loading, EmptyState, CommandPalette, ShortcutHelp, OnboardingWizard
          ui/              ← Shadcn UI components (button, card, dialog, etc.)
        lib/
          auth/            ← OAuth flows (GitHub, Atlassian, RH SSO, Google), PKCE, AuthManager, SW bridge
          cache/           ← IndexedDB cache with TTL support
          commands/        ← Command palette registry + default commands
          fetch/           ← resilientFetch (backoff, dedup, Retry-After)
          github/          ← GitHubClient REST client, git-ops (atomic commits)
          jira/            ← JiraClient REST client, cache, TanStack Query hooks
          llm/             ← LLMProvider interface, 5 providers, stream parsers, system prompt, tool router
          shortcuts/       ← Keyboard shortcut registry + React hook
          vfs/             ← VirtualFileSystem, content-addressed cache
        stores/            ← Zustand stores (board, chat, ide, toast)
      public/
        sw.js              ← Service Worker (caching, auth injection, LLM relay)
      index.html
      vite.config.ts
      vitest.config.ts
    engine/                ← Rust WASM module
      src/
        lib.rs             ← wasm-bindgen entry, ProxyEngine
        types.rs           ← AuthLevel, Scope, Content, Tool, Manifest, ResolvedContent
        hierarchy.rs       ← scope resolution + merge (most-specific-wins, deterministic tie-break)
        config.rs          ← YAML config parsing (scopes, components)
        catalog.rs         ← tool catalog (search, lookup)
        sandbox.rs         ← QuickJS sandbox (stub)
        auth_filter.rs     ← visibility tier filtering
        mcp.rs             ← MCP protocol handler (tools/list, tools/call)
      Cargo.toml
  config/
    scopes.yml             ← scope definitions with visibility tiers
    components.yml         ← component → repo mapping
```
