# Feature: Keyboard Shortcuts and Command Palette

## User Story
As a power-user contributor, I want to navigate Aegis entirely via keyboard so that I can move between board, chat, and IDE as fast as I do in my local editor.

## Problem
Aegis targets developers who live in tools like VS Code, Vim, and terminal emulators -- all keyboard-driven environments. The current Aegis UI has zero keyboard shortcuts and no command palette. Every action requires mouse navigation through the sidebar, header, or card buttons. This creates a significant experience gap that makes Aegis feel sluggish compared to:

- **Cursor/Windsurf**: Full VS Code keybinding set plus AI-specific shortcuts (Cmd+K for inline edit, Cmd+L for chat)
- **Linear**: Cmd+K command palette is the primary navigation mechanism. Keyboard shortcuts for every action.
- **github.dev**: Inherits VS Code's full command palette (Cmd+Shift+P) and keybinding system
- **GitHub Projects**: Keyboard navigation for board views

The absence of keyboard shortcuts is especially painful for the IDE view, where a developer is already in a code-editing mindset and expects keyboard-first interaction. Switching between the editor and AI chat panel should be a keystroke, not a mouse movement.

## Proposed Solution

### 1. Command Palette (Cmd+K / Ctrl+K)
A search-driven command palette overlay, following the pattern established by Linear, VS Code, and Raycast:

- **Trigger**: `Cmd+K` (macOS) / `Ctrl+K` (Windows/Linux)
- **Search**: Fuzzy-match across commands, recent issues, navigation destinations
- **Categories**:
  - **Navigation**: "Go to Board", "Go to Settings", "Go to Issue AAP-1234"
  - **Actions**: "Create PR", "Commit Changes", "Switch LLM Provider", "Toggle Theme"
  - **Issue search**: Type an issue key or summary text to jump directly to its chat or IDE view
  - **File search** (IDE only): Type a filename to open it in the editor (equivalent to Cmd+P in VS Code)
- **Recents**: Show last 5 accessed issues/views at the top when the palette opens with no query
- **Keyboard navigation**: Arrow keys to move, Enter to select, Escape to dismiss

### 2. Global Keyboard Shortcuts
Always active regardless of the current view:

| Shortcut | Action |
|---|---|
| `Cmd+K` | Open command palette |
| `Cmd+1` | Navigate to Board |
| `Cmd+2` | Navigate to Chat (current issue) |
| `Cmd+3` | Navigate to IDE (current issue) |
| `Cmd+,` | Navigate to Settings |
| `Cmd+/` | Show keyboard shortcuts help overlay |
| `?` | Same as Cmd+/ (when not in a text input) |

### 3. Board-Specific Shortcuts

| Shortcut | Action |
|---|---|
| `j` / `k` | Move focus between cards (down/up) |
| `h` / `l` | Move focus between columns (left/right) |
| `Enter` | Open card detail panel |
| `c` | Open AI Chat for focused card |
| `e` | Open IDE for focused card |
| `/` | Focus the filter search bar |
| `r` | Refresh board data |

### 4. Chat-Specific Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+Enter` | Send message (already standard for chat UIs) |
| `Escape` | Stop streaming response |
| `Cmd+Shift+C` | Copy last AI response to clipboard |

### 5. IDE-Specific Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+P` | Quick file open (file search palette) |
| `Cmd+Shift+P` | Full command palette |
| `Cmd+B` | Toggle file explorer sidebar |
| `Cmd+J` | Toggle AI chat panel |
| `Cmd+Shift+G` | Focus source control panel |
| `Cmd+Enter` | Commit (when source control is focused) |

### 6. Shortcuts Help Overlay
A modal (triggered by `Cmd+/` or `?`) showing all available shortcuts for the current context, organized by category. Similar to GitHub's `?` shortcut help.

## Impact Assessment
- User impact: **High** -- keyboard shortcuts are table-stakes for developer tools. Their absence makes Aegis feel like a prototype rather than a production tool. The command palette in particular is the fastest way to navigate any app and is expected by the target audience.
- Effort estimate: **M** -- the command palette UI is ~200 lines (Dialog + search input + result list). Global shortcut registration is ~50 lines (a `useHotkeys` hook or raw `keydown` listener). Per-view shortcuts are ~30 lines each. Total: ~400 lines of new code.
- Risk: Shortcut collisions with Monaco editor keybindings in the IDE view. Mitigated by only registering IDE-specific shortcuts when the Monaco editor does not have focus, and using Monaco's built-in keybinding system for editor-specific shortcuts.

## Competitive Analysis
| Tool | Keyboard Support | Command Palette |
|---|---|---|
| Linear | Excellent -- every action has a shortcut | Cmd+K, fuzzy search across everything |
| Cursor | Excellent -- VS Code keybindings + AI shortcuts | Cmd+Shift+P (VS Code palette) |
| Windsurf | Excellent -- same as Cursor | Cmd+Shift+P |
| github.dev | Excellent -- full VS Code keybindings | Cmd+Shift+P |
| GitHub Projects | Good -- basic navigation shortcuts | No dedicated palette |
| Shortcut | Good -- common actions have shortcuts | Cmd+K search |
| **Aegis (today)** | None | None |

## Technical Sketch

**New files:**
- `src/components/shared/CommandPalette.tsx` -- the palette dialog UI. Uses Radix Dialog + Shadcn Input + a custom fuzzy-search function. Renders a list of `CommandItem` objects with icon, label, shortcut hint, and action callback.
- `src/components/shared/ShortcutsHelp.tsx` -- the shortcuts help overlay modal.
- `src/lib/commands/registry.ts` -- a command registry that views can register/unregister commands into. Stores `{ id, label, icon, shortcut, action, context }` entries. The command palette queries this registry.
- `src/lib/commands/use-hotkeys.ts` -- a `useHotkeys(shortcut, handler, options)` hook that registers global keydown listeners with proper modifier key handling and input-element exclusion.

**Modified files:**
- `src/routes/__root.tsx` -- mount `CommandPalette` and `ShortcutsHelp` in the root layout. Register the `Cmd+K` and `Cmd+/` global shortcuts.
- `src/components/board/BoardView.tsx` -- register board-specific shortcuts (`j/k/h/l/Enter/c/e`) on mount, unregister on unmount.
- `src/components/chat/ChatView.tsx` -- register chat shortcuts (`Cmd+Enter`, `Escape`, `Cmd+Shift+C`).
- `src/components/ide/IDELayout.tsx` -- register IDE shortcuts (`Cmd+B`, `Cmd+J`, `Cmd+Shift+G`). Coordinate with Monaco's keybinding context to avoid collisions.
- `src/components/shared/Sidebar.tsx` -- add shortcut hints next to navigation items (e.g., small gray `Cmd+1` text).

**Dependencies:** None new. The `useHotkeys` hook is ~40 lines of vanilla DOM event handling. No need for a library like `react-hotkeys-hook` given the limited scope.
