# Proposal: Unified UI State Management -- Consolidate Theme, Sidebar, and Shortcuts into Shared Stores

## Type: systemic

## Source
- **new-contributor P2**: Theme toggle is duplicated between Header and Settings (independent `isDark` state, no sync)
- **new-contributor P8**: Command palette "Toggle Sidebar" uses brittle DOM query (`querySelector('aside')?.classList.toggle('hidden')`)
- **power-user U5**: Sidebar toggle and theme toggle via command palette use DOM manipulation, desync from React state (Header icon shows wrong mode)
- **power-user C1/error-paths C1**: Escape key "Stop Streaming" shortcut dispatches custom event that nothing listens for (event-based communication gap)
- **power-user C2/new-contributor C5**: Board navigation shortcut `g b` uses hardcoded boardId `'1'`, inconsistent with rest of app using `'default'`
- **power-user U6**: Board Escape shortcut always fires even when card detail is closed, preventing event propagation
- **power-user P6**: Command palette shows hardcoded shortcut hints that don't match the actual shortcut registry
- **error-paths U3**: ErrorBoundary retry does not re-fetch data or reset route state (no integration with TanStack Query)
- **performance P8**: Theme toggle in header does not persist across sessions (no shared localStorage read on mount)

## Problem
UI state that should be centralized is instead scattered across three independent mechanisms: (1) React `useState` in individual components (Header theme toggle, Settings theme toggle), (2) direct DOM manipulation (command palette sidebar/theme toggles), and (3) custom DOM events that are dispatched but never consumed (Escape-to-stop-streaming). This creates desynchronization: toggling theme via the command palette does not update the Header icon, toggling sidebar via command palette bypasses React rendering, and the Escape shortcut for stopping chat generation is completely broken. Additionally, constants like the default board ID are hardcoded inconsistently across 5 locations.

## Solution
Replace the fragmented state management with three shared Zustand stores and a constants module:

### 1. Theme store (`src/stores/theme.ts`)
```typescript
interface ThemeStore {
  isDark: boolean;
  toggle: () => void;
}
```
- On initialization, read from `localStorage.getItem('aegis_theme')`, falling back to `prefers-color-scheme` media query.
- On `toggle()`, update `document.documentElement.classList`, persist to localStorage, and update the Zustand state atomically.
- **`src/components/shared/Header.tsx`**: Replace local `isDark` state with `useThemeStore()`.
- **`src/routes/settings.tsx`**: Replace local `useTheme()` hook with `useThemeStore()`.
- **`src/lib/commands/default-commands.ts`**: Replace DOM manipulation (`root.classList.toggle('dark')`) with `themeStore.getState().toggle()`.

### 2. Layout store (`src/stores/layout.ts`)
```typescript
interface LayoutStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}
```
- **`src/components/shared/Sidebar.tsx`**: Conditionally render based on `sidebarOpen` state.
- **`src/lib/commands/default-commands.ts`**: Replace `querySelector('aside')?.classList.toggle('hidden')` with `layoutStore.getState().toggleSidebar()`.
- This store is also required by the responsive layout proposal (systemic-responsive-layout) for the mobile hamburger toggle.

### 3. Wire the Escape-to-stop-streaming shortcut
Instead of dispatching a custom DOM event that nothing listens for:
- **`src/routes/issue.$issueKey.chat.tsx`**: The Escape shortcut handler should call a `stopStreaming(issueKey)` action on the chat store directly.
- **`src/stores/chat.ts`**: Add a `stopStreaming(issueKey: string)` action that calls the AbortController stored in the session. Expose an `abortControllerRef` per session (or use a `Map<string, AbortController>` alongside the sessions Map).
- **`src/components/chat/ChatView.tsx`**: When creating the AbortController for a streaming request, register it with the chat store via `setAbortController(issueKey, controller)`. The store's `stopStreaming` action calls `controller.abort()`.
- Remove the orphaned `CustomEvent('aegis:stop-streaming')` dispatch.

### 4. Constants module (`src/lib/constants.ts`)
```typescript
export const DEFAULT_BOARD_ID = 'default';
```
- Replace hardcoded board IDs in:
  - `src/routes/__root.tsx:37` (`boardId: '1'` -> `DEFAULT_BOARD_ID`)
  - `src/components/shared/Sidebar.tsx:19` (`boardId: 'default'` -> `DEFAULT_BOARD_ID`)
  - `src/lib/commands/default-commands.ts:48` (`boardId: 'default'` -> `DEFAULT_BOARD_ID`)
  - `src/routes/index.tsx:132` (`boardId: 'default'` -> `DEFAULT_BOARD_ID`)
  - Any other occurrences.
- This also fixes the `g b` shortcut navigating to a different board than the sidebar.

### 5. Command palette shortcut hints from registry
- **`src/lib/commands/default-commands.ts`**: Instead of hardcoded `shortcut: '...'` strings, look up the actual registered shortcut from `shortcutRegistry.getShortcuts()` by matching on the action description. If no shortcut is registered, omit the hint.

### 6. ErrorBoundary retry with cache reset
- **`src/components/shared/ErrorBoundary.tsx`**: Import the QueryClient from `src/main.tsx` (or access via `useQueryClient` in a functional wrapper). On retry, call `queryClient.clear()` to evict potentially corrupted cache entries before re-rendering children. This prevents the infinite crash loop when malformed data caused the original error.

## Effort: S

## Files affected
- `packages/app/src/stores/theme.ts` (new file)
- `packages/app/src/stores/layout.ts` (new file)
- `packages/app/src/stores/chat.ts` (add stopStreaming action, AbortController map)
- `packages/app/src/lib/constants.ts` (new file -- shared constants)
- `packages/app/src/components/shared/Header.tsx` (use theme store)
- `packages/app/src/components/shared/Sidebar.tsx` (use layout store, use DEFAULT_BOARD_ID)
- `packages/app/src/routes/__root.tsx` (use DEFAULT_BOARD_ID for `g b` shortcut)
- `packages/app/src/routes/settings.tsx` (use theme store)
- `packages/app/src/routes/index.tsx` (use DEFAULT_BOARD_ID)
- `packages/app/src/routes/issue.$issueKey.chat.tsx` (call store action instead of CustomEvent)
- `packages/app/src/components/chat/ChatView.tsx` (register AbortController with store)
- `packages/app/src/lib/commands/default-commands.ts` (use stores, constants, and registry for hints)
- `packages/app/src/components/shared/ErrorBoundary.tsx` (clear query cache on retry)

## Test plan
1. **Theme sync**: Toggle theme via Header button, verify Settings page reflects the change. Toggle via command palette, verify Header icon updates. Reload page, verify theme persists from localStorage.
2. **Sidebar sync**: Toggle sidebar via command palette, verify React-rendered sidebar hides/shows (not just CSS class). Toggle via mobile hamburger (after responsive proposal). Verify state is consistent.
3. **Escape-to-stop**: Start a streaming chat response, press Escape, verify streaming stops immediately (AbortController aborted). Verify the Stop button in MessageInput also still works.
4. **Board ID consistency**: Press `g b`, click sidebar Board link, click landing page Browse, use command palette "Go to Board" -- all should navigate to the same board ID.
5. **ErrorBoundary retry**: Inject a rendering error (e.g., corrupt a cached Jira issue), verify ErrorBoundary appears. Click "Try again," verify the query cache is cleared and fresh data is fetched (no crash loop).
6. **Shortcut hints**: Open command palette, verify shortcut hints match the actually registered shortcuts in the shortcut registry.
7. **Unit tests**: Test theme store toggle + persist. Test layout store toggle. Test chat store `stopStreaming` action. Test constants are used consistently (grep for hardcoded board IDs).
