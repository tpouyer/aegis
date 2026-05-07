# UAT: New Outside Contributor -- Cycle 2

**Persona**: First-time visitor, no accounts connected, wants to contribute to an open-source Ansible project.
**Journey**: Landing page -> understand value prop -> try board without auth -> get guided to connect GitHub -> attempt AI chat with own API key -> open IDE -> make an edit -> attempt commit
**Test Date**: 2026-05-07

---

## Critical Issues (blocks user journey)

### C1: Landing page "Connect GitHub" and "Connect SSO" buttons are non-functional
- **Journey step**: User arrives at landing page, understands value prop, clicks "Connect GitHub" to start contributing
- **Expected**: GitHub OAuth PKCE flow should initiate (redirect to github.com/login/oauth/authorize)
- **Actual**: The `handleConnectGitHub` callback at `src/routes/index.tsx:109-111` only logs `console.info('[Landing] GitHub connect flow not yet wired')` and does nothing. Same for `handleConnectSSO` at line 113-115. The OAuth initiation functions (`initiateGitHubAuth` in `src/lib/auth/github.ts:29`, `initiateAtlassianAuth` in `src/lib/auth/atlassian.ts:25`) exist but are never imported or called from any UI component. No visual feedback is given to the user -- the button click silently does nothing.
- **Impact**: **Complete blocker** for the entire contributor onboarding journey. No user can authenticate through the landing page. The only path to settings is clicking the sidebar "Settings" link, but even there the Connect buttons are also no-ops (see C2).

### C2: Settings page "Connect" buttons for all 4 OAuth providers are non-functional
- **Journey step**: User navigates to Settings > Connections and clicks "Connect" next to GitHub
- **Expected**: OAuth flow should initiate for the selected provider
- **Actual**: The `handleConnect` callback at `src/routes/settings.tsx:77-79` only logs `console.info('[Settings] Connect flow for ${_provider} not yet wired')`. The four OAuth modules (`src/lib/auth/github.ts`, `atlassian.ts`, `google.ts`, `redhat-sso.ts`) with their `initiate*Auth()` and `handle*Callback()` functions are fully implemented but never wired to any UI. No toast, no visual feedback, nothing happens.
- **Impact**: **Complete blocker**. There is zero way for any user to authenticate. Board, IDE, and commit features all require Atlassian and/or GitHub auth to function.

### C3: No OAuth callback route exists to complete authentication
- **Journey step**: Even if OAuth initiation were wired, the user returns from the provider with a callback URL
- **Expected**: A route like `/auth/callback` should handle the `code` and `state` URL parameters, call `handleGitHubCallback()` / `handleAtlassianCallback()`, store the token via `authManager.setToken()`, and redirect to the original page
- **Actual**: No callback route exists in `src/routes/`. The route tree (`src/routeTree.gen.ts`) only has `/`, `/settings`, `/board/$boardId`, `/issue/$issueKey/chat`, and `/issue/$issueKey/ide`. The callback handler functions (`handleGitHubCallback` at `src/lib/auth/github.ts:59`, `handleAtlassianCallback` at `src/lib/auth/atlassian.ts:58`, etc.) are defined but never imported or called anywhere in the app.
- **Impact**: **Complete blocker**. Even if C1/C2 were fixed, the OAuth flow would redirect back to an unhandled URL and the token exchange would never execute.

### C4: Board navigates to `boardId: 'default'` which resolves to NaN
- **Journey step**: User clicks "Browse" on landing page, or clicks "Board" in sidebar, or uses command palette "Go to Board"
- **Expected**: A default/demo board should load, or an appropriate empty state should appear
- **Actual**: The sidebar (`src/components/shared/Sidebar.tsx:19`), landing page (`src/routes/index.tsx:132`), and command palette (`src/lib/commands/default-commands.ts:48`) all link to `boardId: 'default'`. The board route at `src/routes/board.$boardId.tsx:13` does `Number(boardId)` which converts `'default'` to `NaN`. Line 82 checks `Number.isNaN(numericBoardId)` and shows `Invalid board ID: default` -- a confusing developer-facing error message.
- **Impact**: **High severity**. The primary navigation to the board feature is completely broken. The only working path would be manually typing a numeric board ID in the URL, but the user has no way to know valid board IDs.

### C5: JiraClient is never initialized -- board queries will throw even after auth
- **Journey step**: User connects Atlassian (hypothetically) and navigates to a board with a numeric ID
- **Expected**: Board loads issues from Jira
- **Actual**: `getJiraClient()` (`src/lib/jira/client.ts:262-267`) throws `'JiraClient not initialized. Call initJiraClient(config) first.'` because `initJiraClient()` is never called anywhere in the app. No code initializes the Jira client with a `baseUrl` and `cloudId`. The initialization requires a `cloudId` from the Atlassian OAuth response, but no app-level code connects the OAuth callback to client initialization. Even with valid auth tokens, the board queries in `queries.ts` crash before any API request is made.
- **Impact**: Board feature is non-functional end-to-end. Even with valid auth tokens, no Jira data will load.

### C6: IDE route immediately makes unauthenticated GitHub API calls with no pre-check
- **Journey step**: User navigates to `/issue/ABC-123/ide` (e.g., from a shared link or direct URL)
- **Expected**: Should check for GitHub auth first and show a clear "Connect GitHub" prompt before making API calls
- **Actual**: `src/routes/issue.$issueKey.ide.tsx:97-129` immediately calls `vfs.ensureBranch()` which calls `githubClient.branchExists()` -> `githubClient.getRef()` which makes an unauthenticated REST call to `api.github.com`. Without a GitHub token, the Service Worker passes the request through without auth headers (`sw.js:157-159`). For private repos this returns 404; for `ensureBranch()` the write operations (createBranch) will 401. The catch block at line 123-126 shows a generic "IDE initialization failed" error with the raw GitHub API error message and an AlertTriangle icon. The IDE's own GitHub-specific empty state (`IDELayout.tsx:226-239`) is never reached because the error occurs during initialization before IDELayout renders.
- **Impact**: Users see a scary red warning triangle with a cryptic GitHub API error instead of a friendly "Connect GitHub" prompt with actionable guidance.

### C7: ProviderPicker sends API key to Service Worker with incorrect type casting
- **Journey step**: User opens AI chat, configures Anthropic provider with their API key
- **Expected**: API key is securely stored in Service Worker under the correct provider key
- **Actual**: `src/components/chat/ProviderPicker.tsx:202` casts the provider ID as `'github'`: `sendTokenToSW(selected.id as 'github', { ... provider: selected.id as 'github' })`. The `AuthProvider` type is `'github' | 'atlassian' | 'redhat-sso' | 'google'` (`src/lib/auth/types.ts:16`). LLM provider IDs like `'anthropic'` and `'openai'` are not valid `AuthProvider` values. At runtime, the string value passes through as-is (JavaScript ignores TypeScript casts), so `tokens.set('anthropic', ...)` works. However, the SW relay at `sw.js:222` looks up `tokens.get('anthropic')` which depends on this runtime behavior. The type unsafety masks a real design gap -- LLM API keys and OAuth tokens share the same storage mechanism with incompatible type definitions.
- **Impact**: Currently works by accident at runtime, but any future type-checking enforcement or SW refactoring could break LLM API key storage silently. The `sendTokenToSW` function's type signature accepts only `AuthProvider`, so TypeScript would flag this if strict checking were enforced.

---

## UX Issues (confusing or frustrating)

### U1: OnboardingWizard component exists but is never shown to users
- **Journey step**: First visit to Aegis
- **Expected**: A new user should be guided through connecting accounts
- **Actual**: `src/components/shared/OnboardingWizard.tsx` is a fully implemented 4-step wizard (GitHub -> Atlassian -> Google -> LLM) with progress indicators, step descriptions, skip buttons for optional steps, and success confirmation states. But it is never rendered anywhere -- no component imports or mounts `<OnboardingWizard />`. Even its own connect handlers are no-ops (line 94: `console.info('[Onboarding] Connect flow for ${currentStep.id} not yet wired')`).
- **Impact**: The best onboarding experience in the app is invisible. Users must discover Settings on their own and figure out which providers to connect.

### U2: Chat page uses hardcoded mock issue data instead of real Jira data
- **Journey step**: User navigates to `/issue/ABC-123/chat` to discuss an issue
- **Expected**: Real issue data from Jira should populate the context panel
- **Actual**: `src/routes/issue.$issueKey.chat.tsx:31-52` uses `getMockIssue()` which generates fake data: `summary: 'Implement feature for ABC-123'`, `assignee: 'dev-user'`, generic acceptance criteria. Comments at lines 14-15 and 170 say "replaced by Jira client in Phase 2" but this was never done. The AI assistant receives this fabricated context in its system prompt via `buildSystemPrompt()`.
- **Impact**: The context panel misleads users. The AI assistant generates responses based on fake requirements, reducing trust and usefulness.

### U3: Board and IDE auth-required empty states use `window.location.href` for navigation
- **Journey step**: User sees "Connect to Jira" or "Connect to GitHub" empty state and clicks the CTA button
- **Expected**: Smooth SPA navigation to Settings page
- **Actual**: `src/components/board/BoardView.tsx:321` and `src/components/ide/IDELayout.tsx:235` both set `window.location.href = '/settings'` which triggers a full page reload instead of TanStack Router navigation. This destroys all in-memory state (chat sessions, board filters, open IDE tabs, Zustand stores).
- **Impact**: Jarring user experience with a flash of white. After connecting (once that works), users must re-navigate to their previous location and any accumulated state is lost.

### U4: Chat shows ProviderPicker dialog with no context or fallback
- **Journey step**: User opens chat at `/issue/ABC-123/chat` with no LLM provider configured
- **Expected**: Clear explanation that an API key is needed, with guidance on how to get one
- **Actual**: `src/components/chat/ChatView.tsx:76-78` opens the ProviderPicker dialog immediately. While the dialog is well-designed, there is no intermediate state shown. If the user dismisses the dialog (clicks Cancel or outside), the chat page shows a disabled input (`disabled={!session}` at line 303) with no explanation. There is no way to re-open the ProviderPicker except by reloading the page, since the `showProviderPicker` state is only set to `true` once during the initial check.
- **Impact**: Dismissing the provider picker leaves the user on a dead-end page with no way to proceed.

### U5: No navigation path from board cards to chat or IDE
- **Journey step**: User is on the board and wants to discuss an issue with AI or open it in the IDE
- **Expected**: Board card or card detail should have links to `/issue/${issueKey}/chat` or `/issue/${issueKey}/ide`
- **Actual**: `CardDetail` (`src/components/board/CardDetail.tsx`) shows full issue details but has no link to the chat or IDE routes. The sidebar only has Home, Board, and Settings. The only way to reach chat or IDE is by manually typing the URL.
- **Impact**: The core user journey (see issue on board -> discuss with AI -> edit code) is broken because transitions between views are missing. The three features are effectively siloed.

### U6: Landing page auth options don't explain what each level unlocks
- **Journey step**: User sees the "Get Started" section with Guest/Contributor/Red Hat Employee options
- **Expected**: Each option explains what features become available at that auth level
- **Actual**: Guest says "Browse public docs" but clicking Browse goes to the board (which requires Jira auth, see C4/C5). Contributor says "Sign in with GitHub" with no mention of what it unlocks (IDE, commits, PRs). Red Hat Employee says "Sign in with SSO" with no explanation of additional access.
- **Impact**: Users cannot make an informed decision about which auth path to take. The Guest option is misleading since browsing does not work.

### U7: Keyboard shortcut `g b` navigates to `boardId: '1'` while all other board links use `'default'`
- **Journey step**: User presses `g b` to navigate to the board
- **Expected**: Should navigate to the same destination as sidebar/landing page
- **Actual**: `src/routes/__root.tsx:37` uses `boardId: '1'` while sidebar, landing page, and command palette all use `boardId: 'default'`. Board ID `'1'` passes the NaN check but leads to a different error path (Jira API failure) than `'default'` (NaN validation error).
- **Impact**: Two different error states for what the user perceives as the same action. Inconsistent behavior undermines trust.

### U8: Anthropic/OpenAI "Test Connection" gives false positive
- **Journey step**: User enters an API key and clicks "Test Connection"
- **Expected**: Actual API call to verify the key works
- **Actual**: `src/components/chat/ProviderPicker.tsx:183-186` for API key providers only checks `if (!apiKey.trim())` and shows "success" for any non-empty string. Even `sk-invalid123` passes. The Ollama provider actually tests connectivity by calling `detectModels()`, showing this was intentional for some providers but not others.
- **Impact**: User gets false confidence that their key is valid, only to encounter confusing errors during actual chat use.

### U9: Header theme toggle and Settings theme toggle are independently managed
- **Journey step**: User toggles dark mode in the header, then visits Settings
- **Expected**: Settings reflects the current theme state
- **Actual**: Header.tsx uses its own `useState` for `isDark` (line 10) with `useEffect` to toggle the DOM class. Settings.tsx has a separate `useTheme()` hook (line 51-71) with its own `isDark` state. Neither reads from the other. The header does not persist to localStorage; Settings does (`localStorage.setItem('aegis_theme', ...)` at line 66). On page reload, theme defaults to light regardless of header toggle because only the Settings hook reads localStorage.
- **Impact**: Inconsistent theme state between header and settings. Changes in one are not reflected in the other.

---

## Polish Items (works but could be better)

### P1: Landing page tagline is generic and doesn't communicate contributor value
- **Suggestion**: "Guard your workflow, ship with confidence" and "Zero-infrastructure development platform" are vague marketing phrases. For a contributor landing page, something like "Browse issues, discuss with AI, and submit code -- all in your browser" would better communicate value. Consider adding a 2-3 sentence explanation below the tagline.

### P2: IDE hardcodes ansible/awx as the default repository
- **Suggestion**: `src/routes/issue.$issueKey.ide.tsx:29-33` has `getRepoConfig()` returning `{ owner: 'ansible', repo: 'awx' }` with a TODO comment. Every issue opens the same repo regardless of context. Consider reading from URL search params, a Jira custom field, or the component-to-repo mapping in `config/components.yml`.

### P3: IDE PR title uses redundant `${issueKey}: ${issueKey}` pattern
- **Suggestion**: `src/components/ide/IDELayout.tsx:112` creates PR titles like "ABC-123: ABC-123". The second parameter should be the issue summary (available as `issueSummary` from the chat route's mock data or from the issue context).

### P4: IDE right panel shows "AI chat will be available in Wave 3" permanently
- **Suggestion**: `src/components/ide/IDELayout.tsx:256-264` shows a static placeholder message taking 288px (`w-72`). The chat feature exists at the route level already. Consider either hiding this panel, making it collapsible, or embedding a miniaturized ChatView.

### P5: Source Control "Create PR" button is always enabled even without commits
- **Suggestion**: `src/components/ide/SourceControl.tsx:232-233` disables the button only when `isBusy`. A user could click it before committing, creating a no-diff PR or getting a confusing error. Add a check for `lastCommitSha` or pending changes.

### P6: Chat empty state suggested prompts are generic
- **Suggestion**: The four hardcoded prompts (`src/components/chat/ChatView.tsx:319-324`) are identical for every issue. They could reference the specific issue key or summary to feel more contextual.

### P7: No visual hint for discovering keyboard shortcuts or command palette
- **Suggestion**: The `?` shortcut for help and `Cmd+K` for command palette are powerful but completely undiscoverable. Consider a small hint in the header/footer or a first-time tooltip.

### P8: Error boundary lacks "Go Home" escape route
- **Suggestion**: `ErrorBoundary.tsx` only offers "Try again" which re-renders the crashing component. Adding a "Go to Home" link would give users a safer recovery path.

### P9: Theme not initialized from localStorage on first Header render
- **Suggestion**: `Header.tsx` checks `document.documentElement.classList.contains('dark')` but not `localStorage.getItem('aegis_theme')`. On page reload, the theme defaults to light even if previously set via Settings.

### P10: Command palette lacks auth and issue-related commands
- **Suggestion**: The default commands include navigation but no commands for "Connect GitHub", "Open Issue", "Configure AI Provider", or "Search Issues". These are high-value actions for the command palette.

---

## Positive Observations

- **Well-structured empty states**: The `EmptyState` component (`src/components/shared/EmptyState.tsx`) with four variants (info, auth-required, no-data, error) provides consistent messaging with appropriate icons, colors, and optional CTA buttons. The board's auth-required state is a good example of guiding users when a dependency is missing.

- **Thoughtful keyboard navigation**: The shortcut system (`src/lib/shortcuts/`) with scope-based registration (global, board, chat, ide), chord support (g b), and the `ShortcutHelp` overlay is well-architected. Board j/k/Enter navigation for cards and Escape to close panels shows attention to power-user productivity.

- **Sound security model for tokens**: Storing actual tokens only in Service Worker memory (`sw.js:44`) and keeping only metadata in localStorage (`src/lib/auth/manager.ts:281-297`) is a genuine security improvement that protects against XSS token exfiltration.

- **Content-addressed caching in VFS**: The blob SHA-based caching in `src/lib/vfs/virtual-fs.ts:130` ("content-addressed, never stale") is elegant and avoids cache invalidation complexity. Combined with IndexedDB caching for Jira data with tiered TTLs, the architecture is well-designed for API rate-limit constraints.

- **Comprehensive drag-and-drop with optimistic updates**: The board DnD implementation (`BoardView.tsx:119-212`) with optimistic UI updates, transition validation, field-required modal support, and rollback on failure follows a robust pattern.

- **LLM provider abstraction**: The `ProviderRegistry` with four provider implementations sharing a common interface, the SW relay for API key injection, and SSE stream parsing make it straightforward to add new providers.

- **Chat session persistence**: Sessions persist via IndexedDB with 7-day TTL. The streaming/abort controller pattern is correctly implemented with proper cleanup on component unmount.

- **Service Worker LLM relay**: Routing all LLM API calls through `/_aegis/llm/` with the SW rewriting URLs and injecting auth headers keeps API keys out of page JavaScript scope.

- **Command palette with fuzzy search**: The `CommandPalette` with `>` for files and `/` for actions, keyboard navigation, category grouping, and group headers is a polished UX pattern.

- **Error boundary at root level**: The `ErrorBoundary` in the root layout prevents white-screen-of-death scenarios and provides a retry mechanism.

- **Toast notification system**: The Zustand-based toast store with auto-dismiss, manual close, multiple severity levels, and convenience helpers (`toast.success()`, `toast.error()`) provides good user feedback infrastructure.

---

## Summary

The app has strong architectural foundations (auth model, VFS, LLM abstraction, keyboard shortcuts, caching) but the new contributor journey is critically broken at multiple points:

1. **No working auth flow**: All "Connect" buttons are console.info no-ops (C1/C2), and no OAuth callback route exists (C3).
2. **Board navigation is broken**: The default boardId "default" fails NaN validation (C4), and JiraClient is never initialized (C5).
3. **IDE fails ungracefully without auth**: Users see a scary error triangle with raw GitHub API errors instead of a friendly connect prompt (C6).
4. **LLM API key storage has type safety issues**: ProviderPicker casts LLM provider IDs to `'github'` AuthProvider type (C7).

A new outside contributor currently cannot complete any step of their journey beyond viewing the landing page. The highest-priority fixes are:

1. Wire OAuth connect buttons to the existing `initiate*Auth()` functions (C1/C2)
2. Add an OAuth callback route that calls `handle*Callback()` and stores tokens (C3)
3. Handle the `'default'` boardId with a board selector or proper empty state (C4)
4. Add JiraClient initialization after Atlassian OAuth completes (C5)
5. Add GitHub auth pre-check in the IDE route before making API calls (C6)
6. Fix ProviderPicker type casting to use proper LLM provider key types (C7)
