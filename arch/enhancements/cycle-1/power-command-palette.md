# Feature: Global Command Palette

## User Story
As a Red Hat engineer using Aegis daily, I want a keyboard-invoked command palette so that I can navigate between views, search issues, open files, and trigger actions without lifting my hands from the keyboard.

## Problem
Aegis currently requires mouse-driven navigation through the Sidebar component (Home, Board, Settings links) and the Header. There are no global keyboard shortcuts. A power user working a 10-ticket day has to click through the sidebar to switch from the board, to a chat, to the IDE, and back -- easily 50+ navigation clicks per day that could be instant keystrokes. The FilterBar on the board provides text search, but only for the currently loaded board; there is no cross-view issue lookup.

Every modern developer tool that power users adopt has a command palette: VS Code (Cmd+Shift+P), Cursor (Cmd+K), JetBrains (Shift+Shift / Cmd+Shift+A), Linear (Cmd+K), and even GitHub.com (Cmd+K). Users who spend 6+ hours/day in Aegis will instinctively try Cmd+K within the first 10 minutes.

## Proposed Solution
Add a global command palette overlay triggered by `Cmd+K` (macOS) / `Ctrl+K` (Windows/Linux).

**Behavior:**
1. Pressing the shortcut opens a centered modal with a text input and a scrollable result list.
2. The input supports three modes, auto-detected from the typed text:
   - **Issue search** (default) -- type text to fuzzy-match against cached issue keys and summaries. Selecting an issue offers sub-actions: "Open on board", "Open chat", "Open IDE".
   - **File search** -- prefix with `>` to search open-repo file trees (like VS Code's Cmd+P). Only available when an IDE session is active.
   - **Command mode** -- prefix with `/` to browse and execute actions: "Toggle theme", "Refresh board", "Clear filters", "Switch LLM model", "Create PR", "Commit changes".
3. Results update as you type with debounced filtering (no network calls -- all data from Zustand stores and IndexedDB cache).
4. Arrow keys navigate results; Enter selects; Escape dismisses.
5. Recently used commands and issues float to the top (recency stored in localStorage).

**Keyboard shortcut map (registered at root):**
- `Cmd+K` -- Open palette
- `Cmd+Shift+P` -- Open palette in command mode (pre-filled `/`)
- `Cmd+P` -- Open palette in file mode (pre-filled `>`, IDE only)

## Impact Assessment
- User impact: **High** -- eliminates the largest friction point for daily power users; this is the single feature most likely to keep keyboard-centric developers in Aegis instead of falling back to separate tools.
- Effort estimate: **M** -- new component (`CommandPalette.tsx`), a thin Zustand store for recency/history, global keydown listener in `__root.tsx`. No new API calls; sources from existing cached data.
- Risk: Must not capture keyboard events that Monaco needs (Cmd+K is used by Monaco for some chords). Mitigation: disable the global listener when a Monaco editor has focus, and let Monaco's own Cmd+K pass through.

## Competitive Analysis
| Tool | Palette | Trigger | Notable capability |
|------|---------|---------|-------------------|
| VS Code | Command Palette | Cmd+Shift+P | 1000+ commands, extension-contributed |
| VS Code | Quick Open | Cmd+P | File search with `:line` jump |
| Cursor | AI Command | Cmd+K | Inline AI generation from palette |
| Linear | Command Menu | Cmd+K | Issue search, navigation, bulk actions |
| JetBrains | Search Everywhere | Shift+Shift | Files, classes, actions, settings |
| Jira Cloud | Quick Search | / | Issue search with recent history |

Aegis's palette combines Linear's issue search with VS Code's file/command modes -- appropriate for a tool that spans kanban + IDE.

## Technical Sketch

**New files:**
- `components/shared/CommandPalette.tsx` -- the overlay UI (Radix Dialog + Cmdk or hand-rolled list)
- `stores/palette.ts` -- recency history, open/close state

**Modified files:**
- `routes/__root.tsx` -- register global `keydown` listener, render `<CommandPalette />` at root
- `stores/board.ts` -- expose a selector for cached issue keys+summaries for palette search
- `stores/ide.ts` -- expose file tree data for `>` file mode
- `lib/utils.ts` -- add fuzzy-match utility function

**Approach:**
1. Use Radix Dialog for the overlay (already in dependencies via Shadcn).
2. Fuzzy matching via a lightweight score function (no new dependency; 50 lines of code).
3. Route navigation via TanStack Router's `useNavigate()`.
4. Action dispatch by mapping command strings to store actions or router navigations.
5. Recency list: top 10 recently selected items stored in localStorage, merged into results with a boost score.
