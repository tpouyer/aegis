# Proposal: Responsive Layout System

## Type: enhancement
## Source: UAT-5 C1, UAT-5 U3, UAT-5 U4, UAT-5 U5, Cycle-1 approved: platform-offline-resilience (partial)
## Problem: The entire app is unusable on mobile — sidebar is always 224px, board columns are fixed 288px, IDE has 528px of fixed sidepanels. No responsive breakpoints exist anywhere in the layout.
## Solution:
1. **Sidebar**: Add responsive toggle — `hidden md:flex` with hamburger button
   - Create `src/stores/ui.ts` with `sidebarOpen` state
   - Add hamburger button to Header on `md:hidden`
   - Sidebar becomes a Sheet/drawer on mobile
   
2. **Board columns**: Switch from horizontal scroll to vertical stack on mobile
   - `Column.tsx`: `w-72 md:w-72` → `w-full md:w-72`
   - Board container: `flex-col md:flex-row`

3. **Chat context panel**: Hide by default on mobile, show via toggle
   - `contextOpen` defaults to `false` on `window.innerWidth < 768`

4. **IDE panels**: File explorer and AI sidebar hidden on mobile with toggle buttons
   - Both sidepanels get `hidden lg:block` with toggle buttons

## Effort: M
## Files affected:
- `src/stores/ui.ts` (new)
- `src/components/shared/Sidebar.tsx`
- `src/components/shared/Header.tsx`
- `src/routes/__root.tsx`
- `src/components/board/Column.tsx`
- `src/components/board/BoardView.tsx`
- `src/routes/issue.$issueKey.chat.tsx`
- `src/components/ide/IDELayout.tsx`
## Test plan:
- Resize browser below 768px → sidebar collapses to hamburger
- Board shows stacked columns on mobile
- Chat hides context panel on mobile
- IDE hides sidepanels on mobile
