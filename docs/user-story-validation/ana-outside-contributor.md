# Persona: Ana (Outside Contributor)

## US-1: First-Time Landing & Onboarding

### AC-1: [Pass] Landing page loads at `/` and displays a clear value proposition
- `packages/app/src/routes/index.tsx:23` — `createFileRoute('/')` registers the route at `/`.
- `packages/app/src/routes/index.tsx:69-86` — `HeroSection` renders "Aegis", tagline "Guard your workflow, ship with confidence.", and subtitle "Zero-infrastructure development platform".

### AC-2: [Pass] Three feature cards (Kanban Board, AI Chat, Web IDE) are visible
- `packages/app/src/routes/index.tsx:27-43` — `FEATURES` array defines exactly three entries: "Kanban Board", "AI Chat", "Web IDE".
- `packages/app/src/routes/index.tsx:88-109` — `FeatureCards` renders a 3-column grid of Card components, one per feature.

### AC-3: [Pass] "Browse" button navigates to the board (as Guest)
- `packages/app/src/routes/index.tsx:134-139` — `<Button variant="outline" size="sm" asChild><Link to="/board/$boardId" params={{ boardId: '1' }}>Browse</Link></Button>` links to `/board/1` with label "Browse".

### AC-4: [Pass] "Connect GitHub" button initiates the GitHub OAuth flow
- `packages/app/src/routes/index.tsx:112-114` — `handleConnectGitHub` calls `initiateGitHubAuth(getGitHubConfig())`.
- `packages/app/src/routes/index.tsx:147-150` — Button with text "Connect GitHub" and `onClick={handleConnectGitHub}`.
- `packages/app/src/lib/auth/github.ts:29-49` — `initiateGitHubAuth` generates PKCE verifier/challenge, constructs the GitHub OAuth URL with proper params, and redirects via `window.location.href`.

### AC-5: [Pass] "Connect SSO" button initiates the Red Hat SSO flow
- `packages/app/src/routes/index.tsx:116-118` — `handleConnectSSO` calls `initiateRedHatAuth(getRedHatConfig())`.
- `packages/app/src/routes/index.tsx:155-161` — Button with text "Connect SSO" and `onClick={handleConnectSSO}`.

### AC-6: [Pass] If already authenticated, shows auth status instead of connect prompts
- `packages/app/src/routes/index.tsx:220-222` — Conditional: `{authState.isAuthenticated ? <AuthStatusSection /> : <QuickStartSection />}`.
- `packages/app/src/routes/index.tsx:168-206` — `AuthStatusSection` displays "Welcome back", auth level badge, display name, and connected provider badges.

---

## US-2: OAuth Authentication Flow

### AC-1: [Pass] Clicking "Connect GitHub" redirects to GitHub's OAuth authorization page
- `packages/app/src/lib/auth/github.ts:29-49` — `initiateGitHubAuth` builds the URL with `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, `code_challenge_method`, and `response_type`, then sets `window.location.href` to `https://github.com/login/oauth/authorize?...`.

### AC-2: [Pass] After authorizing, the callback route (`/auth/callback`) handles the code exchange
- `packages/app/src/routes/auth.callback.tsx:13` — `createFileRoute('/auth/callback')` registers the callback route.
- `packages/app/src/routes/auth.callback.tsx:34-65` — `exchangeToken()` identifies the provider from the `provider` query param, then dispatches to the correct handler (e.g., `handleGitHubCallback`).
- `packages/app/src/lib/auth/github.ts:59-125` — `handleGitHubCallback` validates state (CSRF check), retrieves the PKCE verifier, exchanges the authorization code for an access token via `POST https://github.com/login/oauth/access_token`, and returns a `TokenSet`.

### AC-3: [Pass] On success, a "Connected!" message shows and user redirects to home
- `packages/app/src/routes/auth.callback.tsx:56-61` — On success: calls `authManager.setToken(provider, tokenSet)`, sets status to `'success'`, fires `toast.success('Connected', ...)`, then `setTimeout(() => navigate({ to: '/' }), 1500)`.
- `packages/app/src/routes/auth.callback.tsx:85-88` — Success UI: `<CheckCircle>` icon, `<h2>Connected!</h2>`, and "Redirecting to home...".

### AC-4: [Pass] On error, an error message shows with a "Go to Settings" button
- `packages/app/src/routes/auth.callback.tsx:62-66` — On error: captures the error message, sets status to `'error'`, fires `toast.error(...)`.
- `packages/app/src/routes/auth.callback.tsx:90-102` — Error UI: `<AlertTriangle>` icon, "Authentication Failed" heading, error message text, and a `<button>` labeled "Go to Settings" that navigates to `/settings`.

### AC-5: [Fail] The auth state updates across the app (sidebar, header, board)
- `packages/app/src/routes/index.tsx:168-206` — Landing page (`AuthStatusSection`) subscribes to auth state changes and reflects connected providers. **Pass for landing page.**
- `packages/app/src/routes/settings.tsx:63-158` — Settings page (`AuthConnectionsSection`) reads `authManager.isConnected()` and `authState.tokens`. **Pass for settings.**
- `packages/app/src/components/shared/Header.tsx:1-32` — Header component only shows theme toggle and sidebar toggle. **No auth status is displayed.** The AC says "sidebar, header, board" but the Header shows no auth state (no avatar, no connected badge, no auth level indicator).
- `packages/app/src/components/shared/Sidebar.tsx:1-62` — Sidebar shows navigation links (Home, Board, Settings) only. **No auth status is displayed.**
- **Verdict:** Auth state does NOT propagate to the sidebar or header. Only the landing page and settings page reflect auth status.

### AC-6: [Pass] Token is stored securely in the Service Worker (not page JS)
- `packages/app/src/lib/auth/manager.ts:108-123` — `setToken()` stores metadata (expiry, provider name) in localStorage but sends the actual token to the SW via `syncTokenToSW()`.
- `packages/app/src/lib/auth/sw-bridge.ts:21-35` — `sendTokenToSW()` sends the full token object (including `accessToken`) to the Service Worker via `postMessage` over a `MessageChannel`.
- `packages/app/src/lib/auth/manager.ts:335-351` — `persistTokenMetadata()` persists only `{ provider, expiresAt, hasRefreshToken }` to localStorage -- the `accessToken` string is NOT stored in localStorage.
- `packages/app/public/sw.js:44` — `const tokens = new Map()` stores tokens in SW memory scope with the comment "Not accessible to page JavaScript (XSS protection)".
- `packages/app/src/lib/auth/manager.ts:358-379` — `restoreTokenMetadata()` restores from localStorage with `accessToken: ''` (empty string), confirming the actual token is never in page JS after a reload.

---

## US-6: AI Chat Session

### AC-1: [Pass] Chat page loads at `/issue/{key}/chat`
- `packages/app/src/routes/issue.$issueKey.chat.tsx:13` — `createFileRoute('/issue/$issueKey/chat')` registers the route. TanStack Router maps `$issueKey` to a dynamic path segment, so `/issue/PROJ-123/chat` works.

### AC-2: [Pass] If no LLM provider configured, ProviderPicker dialog appears
- `packages/app/src/components/chat/ChatView.tsx:74-78` — When `providerRegistry.getDefaultProvider()` returns falsy, `setShowProviderPicker(true)` is called.
- `packages/app/src/components/chat/ChatView.tsx:332-337` — `<ProviderPicker open={showProviderPicker} ... />` renders the dialog.
- `packages/app/src/components/chat/ProviderPicker.tsx:110-367` — Full provider picker dialog with provider list, API key input, endpoint configuration, and test connection.

### AC-3: [Pass] After configuring a provider, chat shows suggested prompts
- `packages/app/src/components/chat/ChatView.tsx:85-98` — `handleProviderSelected` creates or updates the session with the new provider.
- `packages/app/src/components/chat/ChatView.tsx:314-316` — When `session.messages.length === 0`, renders `<ChatEmptyState>`.
- `packages/app/src/components/chat/ChatView.tsx:346-389` — `ChatEmptyState` renders an `EmptyState` with title "Start a conversation about {issueKey}" and four suggested prompt buttons.

### AC-4: [Pass] User messages appear right-aligned; AI responses left-aligned with markdown rendering
- `packages/app/src/components/chat/MessageList.tsx:93` — `<div className={flex ${isUser ? 'justify-end' : 'justify-start'}}>` -- user messages `justify-end` (right), assistant `justify-start` (left).
- `packages/app/src/components/chat/MessageList.tsx:104-110` — Assistant messages rendered with `<ReactMarkdown remarkPlugins={[remarkGfm]}>`.

### AC-5: [Pass] Code blocks have a copy button
- `packages/app/src/components/chat/MessageList.tsx:150-201` — `CodeBlock` component renders a `<Button>` with `aria-label="Copy code"` that calls `navigator.clipboard.writeText()`. The button uses a `<Copy>` icon and shows `<Check>` after copying.

### AC-6: [Pass] Streaming responses show a "Generating..." indicator
- `packages/app/src/components/chat/MessageList.tsx:67-72` — When `isStreaming` is true, renders: `<span className="... animate-pulse ..."/> Generating...`.

### AC-7: [Pass] Escape key stops streaming
- `packages/app/src/routes/issue.$issueKey.chat.tsx:152-159` — Registers an Escape key shortcut in `chat` scope that dispatches `new CustomEvent('aegis:stop-streaming')`.
- `packages/app/src/components/chat/ChatView.tsx:241-244` — Listens for `aegis:stop-streaming` event and calls `abortRef.current?.abort()`, which aborts the streaming fetch.

### AC-8: [Pass] Stop button (square icon) also stops streaming
- `packages/app/src/components/chat/MessageInput.tsx:87-93` — When `isStreaming` is true, renders: `<Button variant="destructive" size="icon" onClick={onStop} aria-label="Stop generating"><Square className="h-4 w-4" /></Button>`.
- `packages/app/src/components/chat/ChatView.tsx:236-238` — `handleStop` calls `abortRef.current?.abort()`.

### AC-9: [Pass] If streaming fails, an error banner shows below the partial response with a "Retry" button
- `packages/app/src/components/chat/ChatView.tsx:205-215` — On stream error (catch block), sets `error` field on the last assistant message.
- `packages/app/src/components/chat/MessageList.tsx:125-139` — When `message.error` is truthy, renders an error banner div with `border-destructive` styling containing the error text and a `<Button>` with `<RefreshCw>` icon and "Retry" text. The `onRetry` handler replays the last user message content.

### AC-10: [Pass] Context panel shows real Jira issue data (or fallback message if Jira not connected)
- `packages/app/src/routes/issue.$issueKey.chat.tsx:168-169` — Checks `authManager.isConnected('atlassian')` and fetches issue data via `useIssue(issueKey, { enabled: jiraConnected })`.
- `packages/app/src/routes/issue.$issueKey.chat.tsx:39-54` — When `issue` is null, `IssueContextPanel` shows "Connect to Jira to see issue details".
- `packages/app/src/routes/issue.$issueKey.chat.tsx:56-134` — When issue data exists, renders status/priority/type badges, assignee, created date, description, labels, and components.

### AC-11: [Pass] Model can be switched via the dropdown in the chat header
- `packages/app/src/components/chat/ChatView.tsx:278-309` — `<DropdownMenu>` in the header with `<DropdownMenuTrigger>` showing the current model name. Each model in `provider.models` is a `<DropdownMenuItem>` that calls `handleModelSwitch(model.id)`.
- `packages/app/src/components/chat/ChatView.tsx:246-250` — `handleModelSwitch` calls `switchModel(issueKey, modelId)` which updates the session's `currentModel`.

### AC-12: [Pass] Provider can be switched mid-session via "Change provider..."
- `packages/app/src/components/chat/ChatView.tsx:302-306` — `<DropdownMenuItem onClick={() => setShowProviderPicker(true)}>Change provider...</DropdownMenuItem>` at the bottom of the model dropdown.
- `packages/app/src/components/chat/ChatView.tsx:85-98` — `handleProviderSelected` callback updates the session's provider and model via `switchProvider` and `switchModel`.

---

## US-8: Settings & Provider Configuration

### AC-1: [Pass] Settings page loads at `/settings` with tabs: Connections, LLM, Appearance, About
- `packages/app/src/routes/settings.tsx:20` — `createFileRoute('/settings')` registers the route.
- `packages/app/src/routes/settings.tsx:344-367` — `<Tabs defaultValue="connections">` with `<TabsTrigger value="connections">Connections</TabsTrigger>`, `<TabsTrigger value="llm">LLM</TabsTrigger>`, `<TabsTrigger value="appearance">Appearance</TabsTrigger>`, `<TabsTrigger value="about">About</TabsTrigger>`.

### AC-2: [Pass] Each auth provider shows connected/disconnected status with connect/disconnect buttons
- `packages/app/src/routes/settings.tsx:24-29` — `AUTH_PROVIDERS` array with four entries: GitHub, Atlassian, Red Hat SSO, Google.
- `packages/app/src/routes/settings.tsx:100-155` — Each provider renders: a colored dot (`bg-green-500` if connected, `bg-muted-foreground/40` if not), a `<Badge>` showing "Connected" or "Disconnected", and either a "Disconnect" (destructive) or "Connect" (outline) button.

### AC-3: [Pass] Connect buttons initiate the correct OAuth flow
- `packages/app/src/routes/settings.tsx:66-81` — `handleConnect` switch dispatches to `initiateGitHubAuth`, `initiateAtlassianAuth`, `initiateRedHatAuth`, or `initiateGoogleAuth` with the corresponding config.

### AC-4: [Pass] Disconnect buttons clear the token
- `packages/app/src/routes/settings.tsx:83-85` — `handleDisconnect` calls `authManager.disconnect(provider)`.
- `packages/app/src/lib/auth/manager.ts:170-185` — `disconnect()` deletes the token from `state.tokens`, recalculates auth level, persists updated metadata, calls `clearTokenInSW(provider)` to remove from SW, and notifies listeners.

### AC-5: [Pass] LLM section shows the configured provider and available models
- `packages/app/src/routes/settings.tsx:160-248` — `LLMProviderSection` renders:
  - If a default provider exists (lines 183-205): provider name, first model name, and capability badges (Tool Use, Streaming).
  - If no provider (lines 206-213): EmptyState with "No AI provider configured".
  - If multiple providers (lines 215-245): lists all providers with Select/Active buttons.

### AC-6: [Pass] Theme toggle switches between light and dark mode consistently across all UI surfaces
- `packages/app/src/routes/settings.tsx:251-295` — `AppearanceSection` uses `useTheme()` hook (backed by `useThemeStore`) and renders a toggle button.
- `packages/app/src/stores/theme.ts:19-34` — `useThemeStore` Zustand store: `toggle()` flips `isDark`, toggles `document.documentElement.classList.toggle('dark', next)`, and persists to `localStorage.setItem('aegis_theme', ...)`.
- `packages/app/src/components/shared/Header.tsx:7,24-29` — Header also uses `useThemeStore` for the theme toggle button.
- Both the Header toggle and Settings toggle use the same Zustand store, so they are guaranteed to stay in sync.

### AC-7: [Pass] About section shows version and link to design document
- `packages/app/src/routes/settings.tsx:297-327` — `AboutSection` renders:
  - `<Badge variant="outline">v0.1.0</Badge>` (line 309).
  - `<a href="https://github.com/tpouyer/aegis/blob/main/docs/design.md" target="_blank" ...>View design document</a>` (lines 316-321).

---

## Defects Found

- **D1**: Auth state not reflected in sidebar or header -- US-2 AC-5 fails. The acceptance criterion states "the auth state updates across the app (sidebar, header, board)" but neither `packages/app/src/components/shared/Sidebar.tsx` nor `packages/app/src/components/shared/Header.tsx` subscribe to or display any auth state (connected providers, auth level, user avatar, etc.). The landing page and settings page do reflect auth state, but the persistent chrome (sidebar + header) does not. To fix, the Header should show the current user's avatar or auth level badge, and the Sidebar could show a connected-provider indicator or user section.

- **D2**: Duplicate `clearExpiredTokens` method in AuthManager -- `packages/app/src/lib/auth/manager.ts` defines `clearExpiredTokens` twice: once as `async` (line 193) with Service Worker cleanup, and once as synchronous (line 266) without SW cleanup. In JavaScript class semantics the second definition shadows the first, so the async version (which also clears tokens from the SW) is never callable. The root layout (`packages/app/src/routes/__root.tsx:26`) calls `authManager.clearExpiredTokens()` on startup, which invokes the sync version that skips `clearTokenInSW()`. This means expired tokens may linger in the Service Worker's memory Map after a page reload even though they are cleaned from the in-memory state. This is a latent bug -- it does not break any AC directly but degrades the security posture described in US-2 AC-6 and relates to US-13 AC-2.
