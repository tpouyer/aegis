# Feature: Context-Aware Keyboard Shortcuts

## User Story
As a Red Hat engineer working through a sprint backlog in Aegis, I want keyboard shortcuts for every frequent action on the board, in the chat, and in the IDE so that I can transition issues, send messages, switch tabs, and commit code without touching the mouse.

## Problem
The current codebase has exactly one keyboard shortcut: `Enter` to send a chat message (in `MessageInput.tsx`). Every other interaction -- dragging cards, opening issue detail, switching editor tabs, toggling diff view, committing, creating PRs -- requires mouse clicks.

Linear's success with power users is largely attributed to its keyboard-first design: `C` to create, `X` to select, `Shift+D` to set due date, `1-4` to set priority. Jira's own keyboard shortcuts (`J/K` to move between issues, `M` to assign to me) are well-known among the Red Hat engineers who are Aegis's target users.

For a developer processing 5-15 issues per day on the board and writing code in the IDE, the absence of shortcuts adds measurable friction and makes Aegis feel like a prototype rather than a production tool.

## Proposed Solution
Add a layered keyboard shortcut system where shortcuts are scoped to the current view context.

**Board shortcuts (active on `/board/:id`):**
| Key | Action |
|-----|--------|
| `J` / `K` | Move focus to next/previous card (Jira-style) |
| `Enter` | Open focused card detail panel |
| `C` | Open chat for focused card |
| `E` | Open IDE for focused card |
| `M` | Assign focused card to me |
| `F` | Focus the filter bar search input |
| `R` | Refresh board |
| `1`-`9` | Jump focus to column N |
| `?` | Show shortcut help overlay |

**Chat shortcuts (active on `/issue/:key/chat`):**
| Key | Action |
|-----|--------|
| `Cmd+Enter` | Send message (alternative to Enter) |
| `Escape` | Stop streaming / cancel |
| `Cmd+Shift+C` | Copy last assistant message |
| `Cmd+/` | Switch model dropdown |

**IDE shortcuts (active on `/issue/:key/ide`):**
| Key | Action |
|-----|--------|
| `Cmd+S` | Save (write to VFS, no-op placeholder for muscle memory) |
| `Cmd+Shift+E` | Toggle file explorer focus |
| `Cmd+Shift+G` | Toggle source control panel |
| `Cmd+W` | Close current tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next/previous tab |
| `Cmd+Shift+D` | Toggle diff view |
| `Cmd+Enter` | Commit (when source control has focus) |

**Global shortcuts (active everywhere):**
| Key | Action |
|-----|--------|
| `Cmd+K` | Command palette (see separate proposal) |
| `Cmd+B` | Toggle sidebar |
| `Cmd+Shift+T` | Toggle theme |

## Impact Assessment
- User impact: **High** -- transforms Aegis from a click-heavy SPA into a keyboard-native tool. The board shortcuts alone will save ~2 seconds per issue interaction, compounding across a full sprint.
- Effort estimate: **S** -- a `useHotkeys` hook (custom or from `react-hotkeys-hook`, already a common lightweight library) plus per-view shortcut registration. No API changes. Board focus tracking requires a new `focusedCardIndex` field in the board store.
- Risk: Shortcut collisions with browser defaults (e.g., `Cmd+W` closes the browser tab). Mitigation: intercept only when the app has focus and the user is not in a text input. `Cmd+W` for tab close should only be intercepted when Monaco does NOT have focus (Monaco handles its own Cmd+W). Provide an escape hatch: all shortcuts are listed in a `?` help overlay and can be discovered.

## Competitive Analysis
| Tool | Shortcut count | Notable pattern |
|------|---------------|-----------------|
| Linear | 50+ | Single-key shortcuts on boards (no modifier needed) |
| Jira Cloud | 30+ | J/K navigation, G+D for dashboard |
| GitHub | 40+ | `?` to show help, `.` to open in github.dev |
| VS Code | 600+ | Fully customizable keybindings.json |
| Cursor | VS Code base + AI | Cmd+K for inline AI, Cmd+L for chat |

Aegis should start with ~25 high-value shortcuts (the ones listed above) and plan for extensibility.

## Technical Sketch

**New files:**
- `lib/keyboard/shortcuts.ts` -- shortcut registry: maps key combos to action IDs, scoped by route
- `lib/keyboard/useShortcuts.ts` -- React hook that registers/unregisters listeners based on active route
- `components/shared/ShortcutHelp.tsx` -- `?` overlay listing all shortcuts for current context

**Modified files:**
- `routes/__root.tsx` -- mount the global shortcut listener
- `routes/board.$boardId.tsx` -- register board-scoped shortcuts
- `routes/issue.$issueKey.chat.tsx` -- register chat-scoped shortcuts
- `routes/issue.$issueKey.ide.tsx` -- register IDE-scoped shortcuts
- `stores/board.ts` -- add `focusedCardIndex`, `focusNextCard()`, `focusPrevCard()` actions
- `components/board/Card.tsx` -- visual focus ring on the focused card
- `components/board/BoardView.tsx` -- pass focus index to Column/Card

**Approach:**
1. Central registry (`shortcuts.ts`) defines shortcuts as `{ key, modifiers, scope, action, description }`.
2. `useShortcuts(scope)` hook subscribes to `keydown` on mount, filters by scope, calls action.
3. Actions are thin dispatchers that call existing store methods or router navigation.
4. Guard: all listeners check `event.target` -- if it's an `<input>`, `<textarea>`, or `[contenteditable]`, single-key shortcuts (without modifiers) are suppressed.
