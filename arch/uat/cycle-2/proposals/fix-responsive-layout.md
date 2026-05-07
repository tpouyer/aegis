# Proposal: Add responsive layout for mobile and tablet viewports

## Type: fix

## Source: UAT-5 (Performance) C1, C2, C3; UAT-5 U5

## Problem
The app has zero responsive behavior. The sidebar is a fixed 224px on all screen sizes, consuming 60% of a phone screen. The IDE has 528px of fixed-width side panels. The chat context panel is 288px fixed. On any device under ~1024px, the IDE is unusable; on phones, Board and Chat are also broken. The filter bar overflows on tablets.

## Solution

1. **Sidebar (`src/components/shared/Sidebar.tsx`)**: 
   - Add `hidden md:flex` to make the sidebar hidden on mobile by default
   - Add a hamburger toggle button in the Header that is `md:hidden`
   - Use a Zustand atom (`sidebarOpen`) to control visibility, replacing the brittle DOM `classList.toggle` in the command palette (also fixes UAT-2 U5)
   - On mobile, render the sidebar as a slide-over overlay with a backdrop

2. **Root layout (`src/routes/__root.tsx`)**: 
   - Update the flex container to support the sidebar being absent on mobile
   - Ensure `<main>` takes full width when sidebar is hidden

3. **IDE panels (`src/components/ide/IDELayout.tsx`)**:
   - File explorer: `hidden lg:block w-60` -- hide on screens smaller than 1024px
   - AI chat placeholder panel: `hidden xl:block w-72` -- hide on screens smaller than 1280px (it is a placeholder anyway)
   - Add toggle buttons visible on smaller screens to show/hide panels as overlays

4. **Chat context panel (`src/routes/issue.$issueKey.chat.tsx`)**:
   - `hidden lg:block w-72` -- hide on screens smaller than 1024px
   - Add a toggle button for mobile users to view issue context as a slide-over

5. **FilterBar (`src/components/board/FilterBar.tsx`)**:
   - Add `flex-wrap` to the filter container
   - On small screens, collapse filters into a single "Filters" dropdown button

## Effort: M

## Files affected
- `packages/app/src/components/shared/Sidebar.tsx` (responsive hiding, mobile overlay)
- `packages/app/src/components/shared/Header.tsx` (hamburger toggle button)
- `packages/app/src/routes/__root.tsx` (layout adjustment)
- `packages/app/src/components/ide/IDELayout.tsx` (responsive panels)
- `packages/app/src/routes/issue.$issueKey.chat.tsx` (responsive context panel)
- `packages/app/src/components/board/FilterBar.tsx` (flex-wrap, mobile collapse)
- `packages/app/src/stores/ui.ts` (new file or extend existing -- sidebar state atom)
- `packages/app/src/lib/commands/default-commands.ts` (use Zustand for sidebar toggle)

## Test plan
- Manual test at 375px viewport (iPhone): sidebar hidden, hamburger visible, board cards full-width
- Manual test at 768px viewport (iPad portrait): sidebar hidden, filter bar wraps, board usable
- Manual test at 1024px viewport (iPad landscape): sidebar visible, IDE shows editor + file explorer (no AI panel)
- Manual test at 1440px viewport (desktop): full layout with all panels
- Unit test: hamburger button toggles `sidebarOpen` state
- Unit test: command palette "Toggle Sidebar" uses Zustand store (not DOM manipulation)
- Verify no horizontal scroll at any breakpoint
