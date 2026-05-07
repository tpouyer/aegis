# Feature: Shareable Deep Links with Pre-Loaded Context

## User Story
As a contributor, I want to share a URL that opens Aegis directly to a specific issue's chat or IDE session so that teammates and reviewers can jump into the exact context I'm working in without navigating from scratch.

## Problem
Aegis already has route-based URLs (`/issue/:key/chat`, `/issue/:key/ide`, `/board/:boardId`), but these routes carry no contextual state. When a contributor pastes a link in Slack or a PR description, the recipient opens it and sees a loading screen that depends on their own auth state and configuration. There is no mechanism to:

1. **Encode board filters** in the URL (e.g., "show only my assigned issues in the API component")
2. **Link to a specific chat message or AI response** (e.g., "look at what the AI suggested for this approach")
3. **Pre-select a file in the IDE** (e.g., "open this file at line 42")
4. **Provide a fallback experience** for recipients who lack auth (e.g., show a read-only snapshot instead of an error)

This matters for adoption because viral sharing is the primary growth lever for developer tools. Every time a contributor pastes a useful link, it exposes a new potential user to Aegis. Linear, Notion, and Figma all grew primarily through link sharing within teams.

Evidence:
- **Linear** URLs encode project, view, and issue state. Shared links work for anyone on the team.
- **github.dev** encodes repo, branch, and file path in the URL. Anyone with access sees exactly what the sharer sees.
- **GitHub Projects** URLs encode view filters and layout configuration.

## Proposed Solution

### 1. Board Filter Persistence in URL
Encode active filters as URL search parameters:

```
/board/42?assignee=tpouyer&component=API&text=labels
```

When the page loads, the board store initializes its `filters` state from URL params. When the user changes filters via the FilterBar, the URL updates via `router.navigate({ search: ... })` without a page reload. This makes filter states bookmarkable and shareable.

### 2. Chat Message Anchors
Add a "Copy link" action to individual chat messages. The link includes a message anchor:

```
/issue/AAP-1234/chat#msg-asst-1715100000000
```

When the page loads with a hash, the MessageList scrolls to and briefly highlights the referenced message. This lets contributors share specific AI suggestions or tool results with teammates.

### 3. IDE File + Line Deep Links
Encode the active file and cursor position in the URL:

```
/issue/AAP-1234/ide?file=awx/api/views/job_templates.py&line=42
```

When the IDE loads, it auto-opens the specified file and scrolls the Monaco editor to the given line. This is directly analogous to how github.dev handles `#L42` anchors.

### 4. Auth-Gated Fallback
When a recipient opens a deep link but lacks the required auth:
- Show the content of the link target in the URL bar (issue key, file path, etc.) so they know what they would see
- Display a clear message: "Sign in with GitHub to view AAP-1234 in the IDE"
- After auth, automatically redirect to the original deep link (store the target URL in sessionStorage before the OAuth redirect)

This "auth redirect preservation" pattern is standard in web apps but currently missing from Aegis. The `AuthManager` has no mechanism to remember where the user was trying to go before being redirected to auth.

## Impact Assessment
- User impact: **High** -- deep links are the #1 viral growth mechanism for developer tools. Every shared link is a potential new user acquisition. Board filter URLs also improve daily usability for existing users.
- Effort estimate: **S** -- URL search params for board filters require ~30 lines in BoardView + FilterBar. Chat anchors require ~20 lines in MessageList. IDE file params require ~20 lines in the IDE route. Auth redirect preservation requires ~15 lines in AuthManager.
- Risk: URL schema becomes a public API that must remain backward-compatible. Mitigated by using simple, human-readable param names and treating unknown params as no-ops.

## Competitive Analysis
| Tool | Deep Link Quality | Notes |
|---|---|---|
| Linear | Excellent | Every view, filter, and issue has a stable URL. "Copy link" on everything. |
| GitHub Projects | Good | View URLs encode filters and layout |
| github.dev | Excellent | Full file path + line number in URL, identical to GitHub web |
| Cursor | Poor | Local app, no shareable URLs |
| Windsurf | Poor | Same as Cursor |
| Shortcut | Good | Issue and view URLs with filter persistence |
| **Aegis (today)** | Basic | Routes exist but carry no contextual state |

## Technical Sketch

**Modified files:**

1. `src/routes/board.$boardId.tsx` -- read search params on mount, pass to board store as initial filter values
2. `src/stores/board.ts` -- accept initial filters from URL params in the store's `setFilters` action; add a `serializeFilters()` method that returns a URLSearchParams-compatible object
3. `src/components/board/FilterBar.tsx` -- on filter change, call `router.navigate({ search: serializeFilters() })` to update the URL
4. `src/components/chat/MessageList.tsx` -- on mount, check `window.location.hash` for a message ID; if found, scroll to that element and apply a highlight animation (CSS `@keyframes` pulse)
5. `src/components/chat/MessageList.tsx` -- add a "Copy link" button (small link icon) to each message's hover state that copies the anchored URL to clipboard
6. `src/routes/issue.$issueKey.ide.tsx` -- read `file` and `line` search params; pass to IDELayout as initial state
7. `src/stores/ide.ts` -- accept `initialFile` and `initialLine` in the IDE store initialization
8. `src/lib/auth/manager.ts` -- add `setPendingRedirect(url: string)` and `consumePendingRedirect(): string | null` methods that use `sessionStorage`
9. `src/routes/__root.tsx` -- after successful auth callback, check for pending redirect and navigate there

**No new dependencies.** TanStack Router already supports search params natively. The hash-based scrolling uses standard DOM APIs (`element.scrollIntoView()`).
