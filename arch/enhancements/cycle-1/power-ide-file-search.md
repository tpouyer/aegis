# Feature: IDE Fuzzy File Finder and Go-To-Symbol

## User Story
As a Red Hat developer working in the Aegis IDE, I want to fuzzy-search file names and jump to symbols within a file so that I can navigate a large repository without manually expanding dozens of folders in the file explorer.

## Problem
The current `FileExplorer.tsx` component renders a full directory tree that the user must expand one folder at a time. For a repo like `awx` with 3,000+ files across deeply nested directories, finding `awx/api/views/job_templates.py` requires 4 clicks to expand the path. There is no search input in the explorer, and no way to jump to a file by name.

VS Code's `Cmd+P` (Quick Open) is one of the most-used features among developers. JetBrains has "Navigate to File" (Cmd+Shift+O). Cursor inherits VS Code's file navigation. github.dev (which Aegis's architecture mirrors) also supports `Cmd+P`. Any developer who has used these tools will immediately notice its absence.

Beyond file search, Go-To-Symbol (Cmd+Shift+O in VS Code) is critical for navigating within a file. Monaco Editor supports this natively via its `editor.action.quickOutline` command, but Aegis does not surface it.

## Proposed Solution

### File Finder (Cmd+P in IDE context)
1. When the IDE route is active, `Cmd+P` opens a file search overlay (distinct from the command palette, or the command palette in `>` file mode -- implementation can be shared).
2. The overlay shows a text input and a list of all files from the VFS tree.
3. As the user types, files are filtered using fuzzy matching with path-segment awareness (e.g., typing `jt.py` matches `api/views/job_templates.py`).
4. Results are ranked by: (a) match quality, (b) recency of access, (c) file depth (shallower files rank higher).
5. Selecting a file opens it in a new editor tab (or focuses the existing tab if already open).
6. The file list is derived from the `TreeEntry[]` already fetched by the VFS -- no new API calls.

### Go-To-Symbol (Cmd+Shift+O in IDE context)
1. When a file is open in Monaco, `Cmd+Shift+O` triggers Monaco's built-in quick outline.
2. This requires calling `editor.trigger('keyboard', 'editor.action.quickOutline', {})` on the Monaco instance.
3. No custom UI needed -- Monaco provides the symbol picker natively for supported languages (TypeScript, Python, Go, etc.).

### Go-To-Line (Ctrl+G in IDE context)
1. `Ctrl+G` triggers Monaco's built-in "Go to Line" dialog.
2. Same pattern: `editor.trigger('keyboard', 'editor.action.gotoLine', {})`.

## Impact Assessment
- User impact: **High** -- file navigation is the most frequent action in any IDE. This feature alone can cut navigation time by 80% on large repos. Every developer expects it.
- Effort estimate: **S** -- The file list data already exists in the VFS tree. Fuzzy matching is ~50 lines. The overlay UI can reuse the command palette infrastructure. Monaco's symbol/line actions are one-liner triggers on the editor instance.
- Risk: Fuzzy matching performance on very large trees (10,000+ entries). Mitigation: the VFS tree is already in memory; fuzzy filtering 10K strings takes <5ms in modern browsers. Can add Web Worker offloading later if needed, but unlikely to be necessary.

## Competitive Analysis
| Tool | File search trigger | Fuzzy matching | Symbol navigation |
|------|-------------------|----------------|-------------------|
| VS Code | Cmd+P | Yes, path-aware | Cmd+Shift+O (outline), Cmd+T (workspace symbols) |
| Cursor | Cmd+P (inherited) | Yes | Same as VS Code |
| JetBrains | Cmd+Shift+O | Yes, with camelCase | Cmd+O (class), Cmd+Shift+O (file) |
| github.dev | Cmd+P | Yes | Cmd+Shift+O |
| Monaco (raw) | Not exposed by default | N/A | Available via `editor.action.quickOutline` |

Aegis should provide the same `Cmd+P` experience as github.dev since it shares the same virtual filesystem model.

## Technical Sketch

**New files:**
- `components/ide/FileFinder.tsx` -- overlay with fuzzy search input and file list (or can be a mode within `CommandPalette.tsx`)
- `lib/search/fuzzy.ts` -- fuzzy match scoring function (reusable by command palette)

**Modified files:**
- `components/ide/IDELayout.tsx` -- register `Cmd+P`, `Cmd+Shift+O`, `Ctrl+G` listeners (or delegate to the shortcut system from the keyboard shortcuts proposal)
- `components/ide/MonacoEditor.tsx` -- expose ref to the Monaco editor instance so parent can call `editor.trigger()` for symbol/line navigation
- `stores/ide.ts` -- add `fileFinderOpen: boolean`, `toggleFileFinder()` action, and `recentFiles: string[]` for recency ranking

**Approach:**
1. `FileFinder` renders as a Radix Dialog with `cmdk`-style input.
2. Source data: `tree: TreeEntry[]` from the IDELayout props, filtered to `type === 'blob'`.
3. Fuzzy match: score each path against the query, sort descending, take top 20.
4. On select: call `useIDEStore.openFile(repoKey, path)` and close the dialog.
5. Monaco triggers: store a `ref` to the `monaco.editor.IStandaloneCodeEditor` in MonacoEditor, pass up via `useImperativeHandle` or a store setter. Parent calls `.trigger()` on shortcut.
