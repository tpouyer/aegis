# Aegis API Reference

Interface contracts for all modules. Together with CLAUDE.md, ADRs, and user stories, this document provides enough detail to reconstruct the codebase.

## Stores (Zustand)

### Board (`src/stores/board.ts`)
```typescript
interface DragState {
  isDragging: boolean;
  sourceColumn: string | null;
  targetColumn: string | null;
  draggedIssueKey: string | null;
}

interface OptimisticUpdate {
  issueKey: string;
  targetStatusId: string;
  originalStatusId: string;
  timestamp: number;
}

interface BoardStore {
  dragState: DragState;
  filters: BoardFilters;
  optimisticUpdates: Map<string, OptimisticUpdate>;
  focusedCardIndex: number;  // -1 = no focus
  totalCardCount: number;

  startDrag(issueKey: string, sourceColumn: string): void;
  endDrag(): void;
  setFilter<K extends keyof BoardFilters>(key: K, value: BoardFilters[K]): void;
  clearFilters(): void;
  applyOptimisticUpdate(update: OptimisticUpdate): void;
  rollbackOptimisticUpdate(issueKey: string): void;
  focusNextCard(): void;
  focusPrevCard(): void;  // no-op if focusedCardIndex < 0
  clearFocus(): void;
  setTotalCardCount(count: number): void;
}
```

### Chat (`src/stores/chat.ts`)
```typescript
interface ChatSession {
  issueKey: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  currentModel: string;
  providerId: string;
}

interface ChatState {
  sessions: Map<string, ChatSession>;
  activeSession: string | null;

  createSession(issueKey: string, providerId: string, model: string): void;
  setActiveSession(issueKey: string | null): void;
  addMessage(issueKey: string, message: ChatMessage): void;
  appendStreamChunk(issueKey: string, content: string): void;
  setStreaming(issueKey: string, streaming: boolean): void;
  switchModel(issueKey: string, model: string): void;
  switchProvider(issueKey: string, providerId: string): void;
  clearSession(issueKey: string): void;   // deletes from memory + IndexedDB
  getSession(issueKey: string): ChatSession | undefined;
  loadSession(issueKey: string): Promise<void>;     // restores from IndexedDB (no-op if already in memory)
  persistSession(issueKey: string): Promise<void>;  // strips error field before IndexedDB write
}

function sessionKey(issueKey: string, providerId: string, modelId: string): string;
// Returns `${issueKey}|${providerId}|${modelId}` — composite key for future multi-provider session scoping.
// Currently sessions are keyed by issueKey only; this helper is available for migration.

function exportChatAsMarkdown(session: ChatSession): string;
```
Persistence: IndexedDB (`aegis-chat` db, `sessions` store), 7-day TTL. Each persisted session includes `providerId` and `currentModel` so the correct provider/model is restored on reload.

### IDE (`src/stores/ide.ts`)
```typescript
interface IDETab { repoKey: string; path: string; isDirty: boolean; }

interface IDEState {
  activeRepo: string | null;
  openTabs: IDETab[];
  activeTab: number;  // -1 = none
  explorerExpandedPaths: Set<string>;
  showDiff: boolean;
  commitMessage: string;

  openFile(repoKey: string, path: string): void;
  closeTab(index: number): void;
  setActiveTab(index: number): void;
  toggleExplorerPath(path: string): void;
  setCommitMessage(msg: string): void;
  toggleDiffView(): void;
  markTabDirty(repoKey: string, path: string, isDirty: boolean): void;
  setActiveRepo(repoKey: string): void;
}
```

### Persona (`src/stores/persona.ts`)
```typescript
type PersonaRole = 'developer' | 'pm' | 'qa' | 'architect' | 'manager' | 'support';
const PERSONA_LABELS: Record<PersonaRole, string>;
const PERSONA_DESCRIPTIONS: Record<PersonaRole, string>;

interface PersonaStore {
  role: PersonaRole;
  setRole(role: PersonaRole): void;
}
```
Persistence: `localStorage` key `aegis_persona`, default `'developer'`.

### Recent (`src/stores/recent.ts`)
```typescript
interface RecentIssue {
  key: string;
  summary: string;
  lastVisited: number;
  lastView: 'chat' | 'ide';
}

interface RecentStore {
  issues: RecentIssue[];
  recordVisit(key: string, summary: string, view: 'chat' | 'ide'): void;
}
```
Persistence: `localStorage` key `aegis_recent_issues`, max 8 items.

### Theme (`src/stores/theme.ts`)
```typescript
interface ThemeState { isDark: boolean; toggle(): void; }
```
Persistence: `localStorage` key `aegis_theme`. Applies `dark` class to `<html>`.

### Sidebar (`src/stores/sidebar.ts`)
```typescript
interface SidebarState {
  sidebarOpen: boolean;
  openSidebar(): void;
  closeSidebar(): void;
  toggleSidebar(): void;
}
```

### Telemetry (`src/stores/telemetry.ts`)
```typescript
interface TelemetryConfig {
  enabled: boolean;
  otlpEndpoint: string | null;
  exportIntervalMs: number;
  localStorageEnabled: boolean;
}
```
Persistence: `localStorage` key `aegis_telemetry`.

### LLM Config (`src/stores/llm-config.ts`)
```typescript
interface LLMProviderConfig {
  id: string;                   // 'openai', 'anthropic', 'vertex', 'ollama', 'custom'
  apiKey?: string;              // for OpenAI, Anthropic
  endpoint?: string;            // for Ollama, Custom
  model?: string;               // for Custom
  gcpProject?: string;          // for Vertex AI
  gcpRegion?: string;           // for Vertex AI
}

interface LLMConfigStore {
  providers: LLMProviderConfig[];
  defaultProviderId: string | null;
  addProvider(config: LLMProviderConfig): void;   // upserts by id, sets as default
  removeProvider(id: string): void;
  setDefault(id: string): void;
}
```
Persistence: `localStorage` key `aegis_llm_providers`. On startup, `restoreProviders()` (`src/lib/llm/restore-providers.ts`) reads this store and re-registers all saved providers with the `providerRegistry`.

### Jira Config (`src/stores/jira-config.ts`)
```typescript
interface JiraConnectionConfig {
  baseUrl: string;              // e.g. https://your-domain.atlassian.net
  email: string;                // Atlassian account email
  apiToken: string;             // API token from id.atlassian.com
}

interface JiraConfigStore {
  config: JiraConnectionConfig | null;
  setConfig(config: JiraConnectionConfig): void;
  clearConfig(): void;
  isConfigured(): boolean;
}
```
Persistence: `localStorage` key `aegis_jira_config`. Used as an alternative to Atlassian OAuth — the Jira client routes requests through the Cloudflare Worker proxy with `X-Jira-Base-URL` and `X-Jira-Auth` headers to avoid CORS.

### Toast (`src/stores/toast.ts`)
```typescript
type ToastType = 'success' | 'error' | 'info';
interface ToastMessage { id: string; type: ToastType; title: string; description?: string; duration?: number; }

const toast: {
  success(title: string, description?: string): string;
  error(title: string, description?: string): string;
  info(title: string, description?: string): string;
};
```

---

## Auth (`src/lib/auth/`)

### Types (`types.ts`)
```typescript
enum AuthLevel { Guest = 'guest', GitHub = 'github', RedHatSSO = 'redhat-sso' }
type AuthProvider = 'github' | 'atlassian' | 'redhat-sso' | 'google';

interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;  // unix ms
  provider: AuthProvider;
}

interface AuthState {
  level: AuthLevel;
  user: UserProfile | null;
  tokens: Partial<Record<AuthProvider, TokenSet>>;
  isAuthenticated: boolean;
}

interface UserProfile {
  id: string; displayName: string; email?: string;
  avatarUrl?: string; authLevel: AuthLevel; connectedProviders: AuthProvider[];
}

interface OAuthConfig { clientId: string; redirectUri: string; scope: string; }
interface GitHubOAuthConfig extends OAuthConfig {}
interface AtlassianOAuthConfig extends OAuthConfig { cloudId?: string; }
interface RedHatSSOConfig extends OAuthConfig { issuerUrl: string; }
interface GoogleOAuthConfig extends OAuthConfig {}
```

### Manager (`manager.ts`)
```typescript
class AuthManager {
  requireAuth(provider: AuthProvider): Promise<TokenSet>;
  isConnected(provider: AuthProvider): boolean;
  getAuthLevel(): AuthLevel;
  getState(): AuthState;
  setToken(provider: AuthProvider, token: TokenSet): Promise<void>;
  isTokenExpired(token: TokenSet): boolean;  // 60s buffer
  disconnect(provider: AuthProvider): Promise<void>;
  clearExpiredTokens(): Promise<void>;  // also clears from SW
  logout(): Promise<void>;
  onAuthChange(callback: (state: AuthState) => void): () => void;
}
const authManager: AuthManager;
```

### Config (`config.ts`)
```typescript
function getGitHubConfig(): GitHubOAuthConfig;   // reads from .well-known > VITE_* > defaults
function getAtlassianConfig(): AtlassianOAuthConfig;
function getRedHatConfig(): RedHatSSOConfig;
function getGoogleConfig(): GoogleOAuthConfig;
```
Resolution: `.well-known/aegis-configuration` > `VITE_*` env vars > defaults.

### OAuth Flows
Each provider has `initiate*Auth(config)` (redirects to provider) and `handle*Callback(params, config): Promise<TokenSet>` (exchanges code). GitHub uses standard Authorization Code flow (no PKCE). Atlassian, Google, and Red Hat SSO use PKCE with S256. State and PKCE verifiers stored in `localStorage` (survives SPA redirect), cleaned up after callback. GitHub and Google token exchanges route through a Cloudflare Worker proxy that injects `client_secret`.

### SW Bridge (`sw-bridge.ts`)
```typescript
function sendTokenToSW(provider: AuthProvider, token: TokenSet): Promise<void>;
function clearTokenInSW(provider: AuthProvider): Promise<void>;
function getTokenStatusFromSW(): Promise<Record<AuthProvider, boolean>>;
```

---

## LLM (`src/lib/llm/`)

### Types (`types.ts`)
```typescript
interface LLMProvider {
  id: string; name: string; models: ModelInfo[];
  supportsToolUse: boolean; supportsStreaming: boolean; maxContextWindow: number;
  chat(params: ChatParams): AsyncIterable<ChatChunk>;
}

interface ChatParams {
  model: string; messages: ChatMessage[];
  systemPrompt?: string; tools?: ToolDefinition[];
  maxTokens?: number; temperature?: number;
  stream?: boolean; signal?: AbortSignal;
}

interface ChatMessage {
  id: string; role: 'user' | 'assistant' | 'system';
  content: string; timestamp: number;
  toolCalls?: ToolCall[]; toolResults?: ToolResult[];
  error?: string;  // transient, not persisted
}

interface ChatChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string; toolCall?: ToolCall; error?: string;
}

interface ToolCall { id: string; name: string; arguments: Record<string, unknown>; }
interface ToolResult { toolCallId: string; content: string; isError?: boolean; }
```

### System Prompt (`system-prompt.ts`)
```typescript
interface SystemPromptParams {
  issueKey?: string; issueSummary?: string;
  issueDescription?: string; acceptanceCriteria?: string;
  orgContext?: Array<{ name: string; body: string }>;
  supportsToolUse: boolean;
  persona?: { role: string; description: string };
}
function buildSystemPrompt(params: SystemPromptParams): string;
```
User content wrapped in `<user_content>` tags with anti-injection instruction.

### Persona Prompts (`persona-prompts.ts`)
```typescript
function getSuggestedPrompts(role: PersonaRole, issueKey?: string): string[];
const PERSONA_SYSTEM_DESCRIPTIONS: Record<PersonaRole, string>;
```

---

## Jira (`src/lib/jira/`)

### Key Types (`types.ts`)
```typescript
interface JiraIssue {
  id: string; key: string; self: string;
  fields: {
    summary: string; description: unknown | null;
    status: JiraStatus; priority: JiraPriority; issuetype: JiraIssueType;
    assignee: JiraUser | null; reporter: JiraUser | null;
    components: JiraComponent[]; labels: string[];
    created: string; updated: string;
    subtasks?: JiraIssueSummary[]; issuelinks?: JiraIssueLink[];
    comment?: { comments: JiraComment[]; total: number; };
  };
}

interface BoardFilters {
  assignee: string | null; component: string | null;
  priority: string | null; text: string | null; issueType: string | null;
}

interface BoardColumn { name: string; statusIds: string[]; issues: JiraIssue[]; }
```

### Client (`client.ts`)
```typescript
class JiraClient {
  constructor(config: { baseUrl: string; cloudId: string });
  getBoards(startAt?, maxResults?): Promise<JiraPaginatedResponse<JiraBoard>>;
  getBoardConfig(boardId: number): Promise<JiraBoardConfig>;
  getIssuesForBoard(boardId, jql?, startAt?, maxResults?): Promise<JiraSearchResponse>;
  getIssue(issueKey: string): Promise<JiraIssue>;  // encodeURIComponent on key
  getTransitions(issueKey: string): Promise<JiraTransition[]>;
  doTransition(issueKey, transitionId, fields?): Promise<void>;
}
function getJiraClient(): JiraClient;  // throws if not initialized
function initJiraClient(config: JiraConfig): JiraClient;
```
401 responses call `authManager.disconnect('atlassian')`.

**Two auth modes:** OAuth (cloudId-based URLs via `*.atlassian.net`) or API token (direct URLs proxied through Cloudflare Worker). When API token auth is active, the client sends requests to the worker with `X-Jira-Base-URL` and `X-Jira-Auth` (Basic Auth) headers — the worker forwards to Jira and adds CORS headers. Proxy URL is read from `.well-known/aegis-configuration`.

### Query Hooks (`queries.ts`)
```typescript
function useBoard(boardId): UseQueryResult<JiraBoardConfig>;
function useIssues(boardId, filters?): UseQueryResult<JiraSearchResponse>;
function useIssue(issueKey, options?): UseQueryResult<JiraIssue>;
function useTransitionMutation(boardId): UseMutationResult;
```

---

## GitHub (`src/lib/github/`)

### Types
```typescript
interface TreeEntry { path: string; mode: string; type: 'blob' | 'tree'; sha: string; }
interface FileContent { path: string; content: string; sha: string; }
interface PullRequest { number: number; title: string; htmlUrl: string; }
interface RepoInfo { owner: string; repo: string; defaultBranch: string; }
```

### Client
```typescript
class GitHubClient {
  getTree(owner, repo, sha, recursive?): Promise<TreeEntry[]>;
  getFileContent(owner, repo, path, ref): Promise<FileContent>;
  createBranch(owner, repo, branchName, fromSha): Promise<GitRef>;
  createBlob(owner, repo, content): Promise<string>;
  createTree(owner, repo, baseTree, entries): Promise<string>;
  createCommit(owner, repo, message, tree, parents): Promise<string>;
  updateRef(owner, repo, ref, sha): Promise<void>;
  createPullRequest(owner, repo, params): Promise<PullRequest>;
  getRepo(owner, repo): Promise<RepoInfo>;
}
const githubClient: GitHubClient;
```

---

## VFS (`src/lib/vfs/`)

```typescript
type FileStatus = 'added' | 'modified' | 'deleted' | 'unchanged';
interface FileChange { path: string; status: FileStatus; originalContent?: string; currentContent?: string; repo: string; }
interface DiffHunk { oldStart: number; newStart: number; lines: DiffLine[]; }

class VirtualFileSystem {
  constructor(github: GitHubClient);
  initRepo(owner, repo, branch): Promise<void>;
  getTree(repoKey): TreeEntry[];
  readFile(repoKey, path): Promise<string>;
  writeFile(repoKey, path, content): void;
  getChanges(repoKey?): FileChange[];
  getDiff(repoKey, path): DiffResult;
  commit(repoKey, message): Promise<string>;
  createPR(repoKey, params): Promise<PullRequest>;
  ensureBranch(owner, repo, branchName): Promise<string>;
}
```

---

## HTTP (`src/lib/fetch/resilient-fetch.ts`)

```typescript
interface RetryConfig {
  maxRetries: number;    // default 3
  baseDelay: number;     // default 1000ms
  maxDelay: number;      // default 10000ms
  retryOn: Set<number>;  // default {429, 500, 502, 503, 504}
}

function resilientFetch(url: string, options?: RequestInit, retryConfig?: Partial<RetryConfig>): Promise<Response>;
```
GET deduplication via `inflightGETs` map. OTEL instrumentation via `recordHttpStart()`.

---

## Telemetry (`src/lib/telemetry/`)

```typescript
async function initTelemetry(): Promise<() => void>;
function loadWellKnownConfig(): Promise<WellKnownConfig>;
function getTelemetryConfig(): TelemetryConfig;
function getHttpMeter(): Meter;
function getLlmMeter(): Meter;
function recordHttpStart(url): { end(status): void; retry(): void; error(type): void; };
async function* instrumentedChat(providerId, modelId, stream): AsyncIterable<ChatChunk>;
function instrumentNavigation(router): void;
```

---

## Commands (`src/lib/commands/`)

```typescript
type CommandCategory = 'navigation' | 'issue' | 'file' | 'action';
interface Command {
  id: string; label: string; description?: string;
  category: CommandCategory; keywords?: string[];
  action: () => void; shortcut?: string;
}

function registerDefaultCommands(navigate): () => void;
```

---

## Component Props

```typescript
// Board
interface BoardViewProps { boardId: number; }
interface IssueCardProps { issue: JiraIssue; index: number; onClick?(key: string): void; isFocused?: boolean; }
interface BoardTableViewProps { issues: JiraIssue[]; onCardClick?(key: string): void; }

// Chat
interface ChatViewProps { issueKey: string; issueSummary: string; issueDescription?: string; acceptanceCriteria?: string; className?: string; }
interface MessageInputProps { onSend(msg: string): void; onStop?(): void; isStreaming: boolean; disabled?: boolean; }
interface MessageListProps { messages: ChatMessage[]; isStreaming: boolean; onRetry?(content: string): void; }

// IDE
interface IDELayoutProps { vfs: VirtualFileSystem; repoKey: string; tree: TreeEntry[]; issueKey: string; branch: string; baseBranch: string; }

// Shared
interface EmptyStateProps { variant?: 'info'|'auth-required'|'no-data'|'error'; icon?: LucideIcon; title: string; description?: string; action?: { label: string; onClick(): void; }; children?: ReactNode; }
interface IssueContextBarProps { issueKey: string; }
interface CommandPaletteProps { open: boolean; onOpenChange(open: boolean): void; }
```

---

## CSS Design Tokens (`src/app.css`)

### Light Mode
| Token | Value |
|-------|-------|
| `--color-primary` | `#0066cc` |
| `--color-background` | `#ffffff` |
| `--color-foreground` | `#151515` |
| `--color-card` | `#ffffff` |
| `--color-muted` | `#f2f2f2` |
| `--color-muted-foreground` | `#707070` |
| `--color-border` | `#e0e0e0` |
| `--color-destructive` | `#b1380b` |
| `--color-sidebar` | `#151515` (always dark) |

### Dark Mode
| Token | Value |
|-------|-------|
| `--color-primary` | `#1890ff` |
| `--color-background` | `#151515` |
| `--color-card` | `#1f1f1f` |
| `--color-muted` | `#292929` |
| `--color-border` | `#383838` |
| `--color-destructive` | `#e35e3d` |

### Typography
- Display: `'Red Hat Display', system-ui, sans-serif` (headings)
- Body: `'Red Hat Text', system-ui, sans-serif`
- Mono: `'Red Hat Mono', ui-monospace, monospace` (code/kbd/pre)

### Radii
sm: 0.25rem, md: 0.5rem, lg: 0.75rem, xl: 1rem

---

## Service Worker (`public/sw.js`)

**Token storage**: In-memory `Map` keyed by provider string. Not accessible to page JS.

**API patterns matched**:
- `*.atlassian.net/rest/api` → inject Atlassian token
- `api.github.com` → inject GitHub token
- `*-aiplatform.googleapis.com` → inject Google token (URL validated against regex)
- `*/_aegis/llm/{provider}/...` → LLM relay (matches any base path prefix)

**LLM relay URL construction**:
- `anthropic` → `https://api.anthropic.com/{path}`
- `openai` → `https://api.openai.com/{path}`
- `vertex` → `https://{path}` (validated: must match `*-aiplatform.googleapis.com`)
- `custom` → `decodeURIComponent(path)` (validated: must start with stored endpoint)

**Token expiry**: Checked before injection with 60s buffer. Expired tokens removed and clients notified via `postMessage`.

**Message types**: `SET_TOKEN`, `CLEAR_TOKEN`, `GET_TOKEN_STATUS`. Source validated (window clients only).
