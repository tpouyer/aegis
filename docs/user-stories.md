# Aegis User Stories

## Persona Definitions

### P1: Outside Contributor (Ana)
New to the project, has a GitHub account, wants to contribute to open-source Ansible repositories. No Red Hat affiliation. Uses own LLM API key.

### P2: Red Hat Engineer (Marcus)  
Senior engineer, daily Aegis user, all accounts connected (GitHub, Atlassian, Google/Vertex AI, Red Hat SSO). Works on multiple issues across repos. Keyboard-power-user.

### P3: Team Lead (Priya)
Manages a team of 6, uses the board primarily for triage and status tracking. Reads issue details and comments. Occasionally uses AI chat for planning.

### P4: Accessibility-Dependent User (Jordan)
Uses keyboard-only navigation and a screen reader (VoiceOver/NVDA). Needs all features to be operable without a mouse.

### P5: Mobile Developer (Sam)
Frequently reviews and triages issues on a phone or tablet while away from their desk. Needs the core board and chat features to work on mobile viewports.

---

## User Stories

### US-1: First-Time Landing & Onboarding
**As** Ana (Outside Contributor)  
**I want to** visit the Aegis landing page and either start working immediately or understand what the tool does  
**So that** I can get to my work or decide to connect my accounts.

**Acceptance Criteria:**
1. Landing page loads at `/`
2. **Authenticated users** see: greeting with name, recent issues grid (last 8 visited), quick actions (Open Board, Configure AI, Settings), collapsible About section
3. **Unauthenticated users** see: hero section with branding, auth CTA (Guest/Contributor/Employee options), expanded feature cards
4. "Connect GitHub" button initiates the GitHub OAuth flow
5. "Connect SSO" button initiates the Red Hat SSO flow
6. Recent issue cards link to the last-visited view (Chat or IDE) for that issue
7. About Aegis section is collapsed by default for returning users with recent issues

---

### US-2: OAuth Authentication Flow
**As** Ana (Outside Contributor)  
**I want to** connect my GitHub account via OAuth  
**So that** I can access GitHub-gated content and use the IDE.

**Acceptance Criteria:**
1. Clicking "Connect GitHub" redirects to GitHub's OAuth authorization page
2. After authorizing, the callback route (`/auth/callback`) handles the code exchange
3. On success, a "Connected!" message shows and user redirects to home
4. On error, an error message shows with a "Go to Settings" button
5. The auth state updates across the app (sidebar, header, board)
6. Token is stored securely in the Service Worker (not page JS)

---

### US-3: Board Viewing & Navigation
**As** Priya (Team Lead)  
**I want to** view my Jira board with issues organized by status columns  
**So that** I can quickly assess the team's sprint progress.

**Acceptance Criteria:**
1. Board loads at `/board/1` and shows columns from Jira board configuration
2. Issues display key, summary, priority (text + color), assignee avatar
3. Sidebar "Board" link navigates to the board
4. Keyboard shortcut `g b` navigates to the board
5. Filter bar allows text search, assignee, component, priority, type filtering
6. "Clear Filters" button resets all filters
7. Last updated timestamp and Refresh button are visible
8. If Jira not connected, shows "Connect to Jira" empty state with action button

---

### US-4: Issue Detail & Navigation
**As** Marcus (Red Hat Engineer)  
**I want to** click a board card to see full issue details and navigate to chat/IDE  
**So that** I can quickly transition from triage to development.

**Acceptance Criteria:**
1. Clicking a card opens a slide-over detail panel (Sheet)
2. Detail shows: status, priority, type badges; assignee; description (with ADF rendering); linked issues; subtasks; comments
3. "AI Chat" button navigates to `/issue/{key}/chat`
4. "Open IDE" button navigates to `/issue/{key}/ide`
5. Escape key or clicking outside closes the panel
6. Keyboard shortcut `j`/`k` moves focus between cards with visible ring highlight
7. `Enter` opens the focused card's detail panel

---

### US-5: Drag-and-Drop Issue Transition
**As** Marcus (Red Hat Engineer)  
**I want to** drag a card from one column to another to transition it  
**So that** I can update issue status without leaving the board view.

**Acceptance Criteria:**
1. Dragging a card shows a visual lift effect (shadow, ring)
2. Target column highlights when a card hovers over it
3. Dropping triggers an optimistic UI update (card appears immediately in new column)
4. If the transition requires fields (hasScreen), a modal appears
5. On API success, a success toast confirms the transition
6. On API failure, the card returns to its original column with an error toast
7. If no valid transition exists for the target column, an error toast explains why

---

### US-6: AI Chat Session
**As** Ana (Outside Contributor)  
**I want to** have an AI-powered conversation about a specific Jira issue  
**So that** I can get implementation guidance and understand acceptance criteria.

**Acceptance Criteria:**
1. Chat page loads at `/issue/{key}/chat`
2. If no LLM provider configured, ProviderPicker dialog appears
3. After configuring a provider, chat shows suggested prompts
4. User messages appear right-aligned; AI responses left-aligned with markdown rendering
5. Code blocks have a copy button
6. Streaming responses show a "Generating..." indicator
7. Escape key stops streaming
8. Stop button (square icon) also stops streaming
9. If streaming fails, an error banner shows below the partial response with a "Retry" button
10. Context panel shows real Jira issue data (or fallback message if Jira not connected)
11. Model can be switched via the dropdown in the chat header
12. Provider can be switched mid-session via "Change provider..."

---

### US-7: Web IDE File Editing
**As** Marcus (Red Hat Engineer)  
**I want to** edit code files in a browser-based IDE scoped to my issue  
**So that** I can make focused changes without leaving the platform.

**Acceptance Criteria:**
1. IDE loads at `/issue/{key}/ide` and shows the file tree, editor, and source control panel
2. File tree shows the repository structure with expandable directories
3. Clicking a file opens it in a tab with syntax highlighting (Monaco editor)
4. Multiple files can be open as tabs simultaneously
5. `Cmd+W` closes the active tab
6. `Cmd+S` is intercepted (prevents browser save dialog)
7. Code/Diff toggle switches between editor and diff view
8. Source control panel shows changed files with A/M/D badges
9. Commit message input and Commit button create a commit
10. Create PR button creates a pull request

---

### US-8: Settings & Provider Configuration
**As** Ana (Outside Contributor)  
**I want to** manage my auth connections and LLM provider settings  
**So that** I can connect/disconnect accounts and configure AI models.

**Acceptance Criteria:**
1. Settings page loads at `/settings` with 3 tabs: Integrations, Preferences, About
2. Integrations tab shows auth providers (connected/disconnected) and LLM provider config
3. Connect buttons initiate the correct OAuth flow; disconnect buttons clear the token
4. LLM section shows the configured provider and available models
5. Preferences tab contains theme toggle and telemetry config (OTLP endpoint, export interval)
6. Theme toggle switches between light and dark mode consistently across all UI surfaces
7. About section shows version and link to design document

---

### US-9: Keyboard Navigation & Command Palette
**As** Marcus (Red Hat Engineer)  
**I want to** navigate and operate the app entirely via keyboard  
**So that** I can work efficiently without switching to the mouse.

**Acceptance Criteria:**
1. `Cmd+K` opens the command palette
2. Command palette supports fuzzy search, arrow key navigation, Enter to execute
3. `>` prefix filters to file commands; `/` prefix filters to action commands
4. `g b` chord navigates to the board
5. `g s` chord navigates to settings
6. `j`/`k` moves focus between board cards with visible focus ring
7. `f` focuses the filter bar search input
8. `Enter` opens the focused card's detail panel
9. `Escape` closes the card detail / clears focus / stops streaming (context-dependent)
10. `?` shows shortcut help overlay

---

### US-10: Accessible Screen Reader Experience
**As** Jordan (Accessibility-Dependent User)  
**I want to** use all features with a screen reader  
**So that** I can participate fully in the development workflow.

**Acceptance Criteria:**
1. Skip navigation link is the first focusable element on every page
2. Page titles update on route changes (e.g., "Board 1 — Aegis")
3. Sidebar links announce "current page" on the active route
4. Board columns have h2 headings; cards are announced with summary and priority text
5. Issue cards have `aria-selected` when keyboard-focused
6. Drag-and-drop is operable via keyboard
7. Chat textarea has `aria-label="Type a message"`
8. Tool result collapsibles have `role="button"`, `aria-expanded`, keyboard operation
9. IDE tabs have `role="tablist"` / `role="tab"` / `aria-selected`
10. File explorer has `role="tree"` / `role="treeitem"` / `aria-expanded`
11. Source control panel header has `aria-expanded`

---

### US-11: Mobile Board & Chat Experience
**As** Sam (Mobile Developer)  
**I want to** triage issues and chat with AI on my phone  
**So that** I can stay productive when away from my desk.

**Acceptance Criteria:**
1. Sidebar collapses to a hamburger menu on viewports < 768px
2. Hamburger button opens sidebar as a slide-over Sheet
3. Board columns stack vertically on mobile
4. Filter bar wraps to multiple lines on narrow screens
5. Chat context panel is hidden by default on mobile
6. IDE file explorer and AI panel are hidden on mobile with toggle buttons
7. All touch targets are at least 44x44px

---

### US-12: Theme Persistence
**As** Priya (Team Lead)  
**I want to** set my preferred theme (light/dark) once  
**So that** it persists across page reloads and is consistent everywhere.

**Acceptance Criteria:**
1. Theme toggle in header updates immediately
2. Theme toggle in Settings > Appearance reflects the same state
3. "Toggle Theme" command in Cmd+K palette uses the same state
4. Theme preference persists to localStorage and survives page reload
5. All three surfaces stay in sync

---

### US-13: Token Expiry & Re-authentication
**As** Marcus (Red Hat Engineer)  
**I want to** be prompted to re-authenticate when my token expires  
**So that** I don't see cryptic errors after an hour of work.

**Acceptance Criteria:**
1. On app startup, expired token metadata is cleaned from localStorage
2. When the Service Worker detects an expired token, it doesn't inject it
3. When a Jira/GitHub API returns 401, the token is cleared and the auth-required empty state is shown
4. The "Connect to Jira" / "Connect to GitHub" empty states link to Settings

---

### US-14: Deployment Configuration via .well-known
**As** a deployer managing an Aegis instance on GitHub Pages  
**I want to** configure the OTLP endpoint and OAuth client IDs by editing a single JSON file  
**So that** I don't need to rebuild the application to change deployment settings.

**Acceptance Criteria:**
1. `/.well-known/aegis-configuration` is served as a static JSON file
2. The file contains `telemetry` (otlpEndpoint, exportIntervalMs, enabled) and `auth` (client IDs for all 4 providers) sections
3. The app fetches this file on startup before initializing telemetry or auth
4. Values from `.well-known` override build-time `VITE_*` defaults
5. User localStorage overrides (from Settings UI) take precedence over `.well-known` values
6. If the file is missing or malformed, the app falls back to env vars and defaults without error

---

### US-15: Telemetry Configuration
**As** Marcus (Red Hat Engineer)  
**I want to** configure metrics export via the Settings page  
**So that** I can send OTEL metrics to my team's collector or disable telemetry entirely.

**Acceptance Criteria:**
1. Settings page has a "Telemetry" tab with Activity icon
2. Enable/disable toggle controls whether metrics are collected
3. OTLP endpoint URL input field with Save button
4. Export interval selector with 15s/30s/1m/5m options
5. Local storage metrics toggle
6. Changes persist to localStorage and take effect without page reload
7. Console metrics appear in dev mode (browser console, 15s interval)
