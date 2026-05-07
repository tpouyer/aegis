# Persona: Sam (Mobile Developer)

## US-11: Mobile Board & Chat Experience

### AC-1: [Pass] Sidebar collapses to a hamburger menu on viewports < 768px

- **Sidebar (desktop):** `packages/app/src/components/shared/Sidebar.tsx:49` — Desktop aside uses `hidden md:flex`, which hides it below 768px (Tailwind's `md` breakpoint) and shows it at 768px+.
- **Sidebar (mobile sheet):** `packages/app/src/components/shared/Sidebar.tsx:54-59` — A `<Sheet>` component wraps `<SidebarNav>` and is controlled by the `sidebarOpen` Zustand state, acting as a slide-over overlay.
- **Hamburger button:** `packages/app/src/components/shared/Header.tsx:13-18` — A `<Menu>` icon button with class `md:hidden` is rendered in the header. It calls `toggleSidebar` from `useSidebarStore`. This means the hamburger is visible only below 768px.
- **State management:** `packages/app/src/stores/sidebar.ts:10-15` — Zustand store with `sidebarOpen`, `openSidebar`, `closeSidebar`, `toggleSidebar` actions.

### AC-2: [Pass] Hamburger button opens sidebar as a slide-over Sheet

- `packages/app/src/components/shared/Sidebar.tsx:54` — The mobile sidebar uses `<Sheet open={sidebarOpen} ...>` with `<SheetContent side="left">`.
- `packages/app/src/components/ui/sheet.tsx:35` — The `left` side variant applies `inset-y-0 left-0 h-full w-3/4 border-r` with slide-in/slide-out animations.
- The Sheet uses Radix Dialog primitive (`@radix-ui/react-dialog`), which provides an overlay (`bg-black/80`) and dismiss-on-click-outside behavior.
- `packages/app/src/components/shared/Sidebar.tsx:57` — `onNavigate={closeSidebar}` closes the sheet when a nav link is tapped.

### AC-3: [Pass] Board columns stack vertically on mobile

- `packages/app/src/components/board/BoardView.tsx:403` — The columns container uses `flex flex-1 flex-col gap-3 overflow-x-auto p-4 md:flex-row`. Below 768px columns stack vertically (`flex-col`); at 768px+ they go horizontal (`md:flex-row`).
- `packages/app/src/components/board/Column.tsx:26` — Each column uses `w-full flex-shrink-0 md:w-72`. On mobile, columns take full width; on desktop they are fixed at 288px (18rem).

### AC-4: [Pass] Filter bar wraps to multiple lines on narrow screens

- `packages/app/src/components/board/FilterBar.tsx:57` — The filter bar container uses `flex flex-wrap items-center gap-2`. The `flex-wrap` class allows items to wrap to subsequent lines when the viewport is narrow.
- `packages/app/src/components/board/FilterBar.tsx:70` — The search input uses `w-full md:w-48`, so on mobile it takes full width, naturally pushing subsequent filter buttons to the next line.

### AC-5: [Pass] Chat context panel is hidden by default on mobile

- `packages/app/src/routes/issue.$issueKey.chat.tsx:143` — The `contextOpen` state initializes with `window.innerWidth >= 768`, so on mobile (< 768px) the panel starts closed.
- `packages/app/src/routes/issue.$issueKey.chat.tsx:197-209` — A toggle button (chevron) allows the user to open/close the context panel.
- `packages/app/src/routes/issue.$issueKey.chat.tsx:42,61` — When open on mobile, the context panel uses `absolute inset-0 z-20` (full overlay), then at `md:` it switches to `md:static md:z-auto md:w-72` (inline sidebar).

### AC-6: [Pass] IDE file explorer and AI panel are hidden on mobile with toggle buttons

- `packages/app/src/components/ide/IDELayout.tsx:68-69` — Both `explorerVisible` and `aiSidebarVisible` default to `false`.
- `packages/app/src/components/ide/IDELayout.tsx:199` — Toggle button bar uses `lg:hidden`, so it only appears below 1024px.
- `packages/app/src/components/ide/IDELayout.tsx:200-219` — Two toggle buttons ("Files" and "AI") with `PanelLeft`/`PanelRight` icons control the respective panel visibility.
- `packages/app/src/components/ide/IDELayout.tsx:225-229` — File explorer: `explorerVisible ? 'block' : 'hidden'` with `lg:block` (always visible at 1024px+).
- `packages/app/src/components/ide/IDELayout.tsx:286-289` — AI sidebar: `aiSidebarVisible ? 'block' : 'hidden'` with `lg:block`.
- Note: The IDE uses `lg` (1024px) breakpoint rather than `md` (768px), which is appropriate since the three-panel IDE layout needs more horizontal space.

### AC-7: [Fail] All touch targets are at least 44x44px

- **Hamburger button (Header):** `packages/app/src/components/shared/Header.tsx:15` — Uses `p-2` (8px padding) around a 20x20px icon. Total: ~36x36px. **Below 44x44px minimum.**
- **Theme toggle (Header):** `packages/app/src/components/shared/Header.tsx:24-25` — Uses `p-2` around a 20x20px icon. Total: ~36x36px. **Below 44x44px minimum.**
- **Card action buttons (Card):** `packages/app/src/components/board/Card.tsx:114,126` — Uses `h-7` (28px height). **Below 44px minimum.**
- **Filter bar buttons:** `packages/app/src/components/board/FilterBar.tsx:159` — Uses `h-8` (32px height). **Below 44px minimum.**
- **Send/Stop button (Chat):** `packages/app/src/components/chat/MessageInput.tsx:88,97` — Uses `size="icon"` which maps to `h-9 w-9` (36x36px) in `packages/app/src/components/ui/button.tsx:26`. **Below 44x44px minimum.**
- **IDE toggle buttons:** `packages/app/src/components/ide/IDELayout.tsx:203,212` — Uses `h-7` (28px). **Below 44px minimum.**
- **File explorer tree items:** `packages/app/src/components/ide/FileExplorer.tsx:108` — Uses `py-0.5` (2px vertical padding) with a text-sm line, yielding roughly 24-28px height. **Well below 44px minimum.**
- **Sidebar nav links:** `packages/app/src/components/shared/Sidebar.tsx:12` — Uses `px-3 py-2` (8px vertical padding) on text-sm, yielding approximately 36px height. **Below 44px minimum.**

Multiple interactive elements across the app do not meet the 44x44px touch target guideline for mobile. This is a systemic issue affecting board cards, filter bar, header buttons, chat input, IDE toggles, and file explorer items.

---

## US-12: Theme Persistence

### AC-1: [Pass] Theme toggle in header updates immediately

- `packages/app/src/components/shared/Header.tsx:6-8` — Uses `useThemeStore` to read `isDark` and `toggle`.
- `packages/app/src/stores/theme.ts:22-33` — The `toggle` action: (1) computes `next = !state.isDark`, (2) calls `document.documentElement.classList.toggle('dark', next)` to immediately update the DOM, (3) persists to localStorage, (4) returns `{ isDark: next }` to update the Zustand state.
- The DOM class toggle is synchronous, so the visual change is immediate. The Zustand state update triggers a React re-render that swaps the Sun/Moon icon.

### AC-2: [Pass] Theme toggle in Settings > Appearance reflects the same state

- `packages/app/src/routes/settings.tsx:55-61` — The `useTheme()` hook reads from the same `useThemeStore` as the header.
- `packages/app/src/routes/settings.tsx:251-295` — The `AppearanceSection` component calls `toggle()` from the same store and displays the current state (`isDark`), showing "Light" or "Dark" on the button.
- Both header and settings share the identical Zustand store instance (`useThemeStore`), so they are always in sync.

### AC-3: [Pass] "Toggle Theme" command in Cmd+K palette uses the same state

- `packages/app/src/lib/commands/default-commands.ts:75-78` — The `action.toggle-theme` command calls `useThemeStore.getState().toggle()`, which is the same store method used by the header and settings.
- Since all three surfaces invoke the same `toggle()` function on the same Zustand store, they all produce the same state change.

### AC-4: [Pass] Theme preference persists to localStorage and survives page reload

- `packages/app/src/stores/theme.ts:27-29` — On toggle, `localStorage.setItem('aegis_theme', next ? 'dark' : 'light')` persists the choice.
- `packages/app/src/stores/theme.ts:8-17` — On initialization, `getInitialTheme()` reads `localStorage.getItem('aegis_theme')` and returns `stored === 'dark'`. If no stored value, falls back to checking `document.documentElement.classList.contains('dark')`.
- The store is initialized once at import time with `getInitialTheme()`, so on page reload the persisted value is read.

### AC-5: [Pass] All three surfaces stay in sync

- All three surfaces (Header toggle, Settings Appearance section, Command Palette "Toggle Theme" command) use the same singleton `useThemeStore` Zustand store.
- Header: `packages/app/src/components/shared/Header.tsx:6-7`
- Settings: `packages/app/src/routes/settings.tsx:58-59`
- Command Palette: `packages/app/src/lib/commands/default-commands.ts:76`
- Zustand reactivity ensures that when any surface calls `toggle()`, all subscribed components re-render with the updated `isDark` value. The DOM class and localStorage are updated synchronously in the same `toggle()` call.

---

## Defects Found

- **D1**: Touch targets below 44x44px minimum across multiple components — US-11 AC-7, multiple files. The hamburger menu button (`Header.tsx:15`, `p-2` = ~36x36px), theme toggle (`Header.tsx:24`, `p-2` = ~36x36px), card action buttons (`Card.tsx:114`, `h-7` = 28px), filter dropdowns (`FilterBar.tsx:159`, `h-8` = 32px), send/stop buttons (`MessageInput.tsx:88,97`, `h-9 w-9` = 36x36px), IDE toggle buttons (`IDELayout.tsx:203,212`, `h-7` = 28px), file explorer tree items (`FileExplorer.tsx:108`, `py-0.5` = ~24px), and sidebar nav links (`Sidebar.tsx:12`, `py-2` = ~36px) all fall below the 44x44px minimum recommended by Apple's HIG and WCAG 2.5.8 for mobile touch targets. This is a systemic issue requiring a responsive approach -- either increasing padding on mobile breakpoints or adding `min-h-[44px] min-w-[44px]` constraints for viewports < 768px.

- **D2**: IDE panels use `lg` (1024px) breakpoint instead of `md` (768px) for mobile behavior — US-11 AC-6, `IDELayout.tsx:199,228,289`. While the file explorer and AI panel toggle buttons only appear below `lg` (1024px), and the panels are hidden by default, this is arguably by design since a three-panel code editor requires more space. However, this is inconsistent with the sidebar and board which use `md` (768px). On a tablet in portrait mode (768-1023px), the IDE shows toggle buttons rather than the full panel layout, which is actually sensible -- marking as informational, not a blocking defect.

- **D3**: Chat context panel covers entire viewport on mobile when opened — US-11 AC-5, `issue.$issueKey.chat.tsx:42,61`. When the context panel is toggled open on mobile, it uses `absolute inset-0 z-20 w-full h-full`, covering the entire chat area. There is no way to see both the chat and context simultaneously on mobile. The toggle button (lines 197-209) uses `absolute right-0` positioning, but when the context panel takes over the full viewport, the toggle button may be obscured or hard to reach. This is a minor UX concern rather than a functional defect -- the panel is correctly hidden by default per AC-5.
