# Plan: Aegis UI/UX Redesign with Red Hat Design Language

## Context
The Aegis UI is functionally complete but feels like an engineering demo — feature-arranged layouts rather than workflow-aware surfaces. The visual design uses generic Tailwind defaults. This redesign applies Red Hat's PatternFly 6 design language (colors, typography, spacing) and restructures the UX around the user's actual workflow: **see issue → discuss → code → ship**.

## Five Workstreams

---

### WS-1: Red Hat Visual Design System (app.css + fonts + tokens)

**Goal**: Replace generic Tailwind blue/gray palette with Red Hat's PatternFly 6 design language.

**Color tokens** (from PatternFly 6 + Red Hat brand):

| Token | Light Mode | Dark Mode | Source |
|-------|-----------|-----------|--------|
| `--color-primary` | `#0066CC` (PF blue) | `#1890FF` (lighter for dark bg) | PatternFly brand |
| `--color-primary-foreground` | `#FFFFFF` | `#000000` | PF |
| `--color-background` | `#FFFFFF` | `#151515` | PF gray scale |
| `--color-foreground` | `#151515` | `#F2F2F2` | PF gray scale |
| `--color-card` | `#FFFFFF` | `#1F1F1F` | PF |
| `--color-muted` | `#F2F2F2` | `#292929` | PF gray |
| `--color-muted-foreground` | `#707070` | `#A3A3A3` | PF gray |
| `--color-border` | `#E0E0E0` | `#383838` | PF gray |
| `--color-accent` | `#F2F2F2` | `#292929` | PF |
| `--color-destructive` | `#B1380B` | `#E35E3D` | PF danger |
| `--color-ring` | `#0066CC` | `#1890FF` | PF brand |
| `--color-sidebar` | `#151515` | `#151515` | Dark sidebar always |
| `--color-sidebar-foreground` | `#F2F2F2` | `#F2F2F2` | Light text on dark sidebar |
| `--color-sidebar-border` | `#292929` | `#292929` | Subtle border |

**Key visual change**: Sidebar goes **dark always** (like PatternFly's masthead/nav pattern, console.redhat.com) — creates a strong anchor on the left that contrasts with the light content area. ✅ User confirmed.

**Red Hat Red (#EE0000)**: Used only for brand identity (logo/header accent) and destructive actions. Primary interactive color stays PatternFly blue (#0066CC). ✅ User confirmed.

**Typography** — add Red Hat font family:
```css
@import url('https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@400;500;700&family=Red+Hat+Text:wght@400;500&family=Red+Hat+Mono:wght@400&display=swap');

:root {
  --font-display: 'Red Hat Display', system-ui, sans-serif;
  --font-body: 'Red Hat Text', system-ui, sans-serif;
  --font-mono: 'Red Hat Mono', ui-monospace, monospace;
}
```

Apply via Tailwind theme extension in `app.css`:
- Headings (h1-h4): `font-family: var(--font-display)`, bold
- Body text: `font-family: var(--font-body)`
- Code/kbd/pre: `font-family: var(--font-mono)`

**Spacing** — PatternFly uses a 4px base grid (same as Tailwind default, no change needed).

**Border radius** — PF6 is slightly more rounded than current:
- `--radius-sm`: `0.25rem` → `0.25rem` (same)
- `--radius-md`: `0.375rem` → `0.5rem` (rounder)
- `--radius-lg`: `0.5rem` → `0.75rem` (rounder)
- `--radius-xl`: `0.75rem` → `1rem` (rounder)

**Files to modify**:
- `packages/app/src/app.css` — all color tokens, font imports, radius values
- `packages/app/index.html` — add Google Fonts preconnect link

---

### WS-2: Landing Page → Context-Aware Launchpad

**Goal**: Replace the marketing-style landing page with a workspace launchpad that shows relevant context immediately.

**New landing page layout**:
```
┌─────────────────────────────────────────────┐
│  Welcome back, Marcus          [Connect ▾]  │  ← greeting or auth CTA
├─────────────────────────────────────────────┤
│                                             │
│  Recent Issues                              │
│  ┌───────┬───────┬───────┬───────┐         │
│  │PROJ-1 │PROJ-2 │PROJ-3 │PROJ-4 │         │  ← clickable cards
│  │Chat ▸ │IDE ▸  │Chat ▸ │Board▸ │         │
│  └───────┴───────┴───────┴───────┘         │
│                                             │
│  Quick Actions                              │
│  [Open Board]  [Configure AI]  [Settings]   │
│                                             │
├─────────────────────────────────────────────┤
│  ▾ About Aegis                              │  ← collapsed by default
│  Feature cards + tagline (for first visit)  │
└─────────────────────────────────────────────┘
```

**For unauthenticated users**: show auth CTA prominently at top, feature cards expanded below.

**New store**: `src/stores/recent.ts` — tracks last 8 visited issue keys in `localStorage`. Updated whenever the user navigates to `/issue/$issueKey/chat` or `/issue/$issueKey/ide`.

**Files to create**:
- `src/stores/recent.ts` — recent issues Zustand store
- `src/components/shared/RecentIssues.tsx` — recent issues card grid

**Files to modify**:
- `src/routes/index.tsx` — rewrite landing page
- `src/routes/issue.$issueKey.chat.tsx` — record issue visit
- `src/routes/issue.$issueKey.ide.tsx` — record issue visit

---

### WS-3: Issue-Scoped Context Bar + Breadcrumbs

**Goal**: When viewing Chat or IDE for an issue, show a persistent context bar that ties the views together and provides navigation breadcrumbs.

**Context bar** — renders below the header when on an issue route:
```
┌──────────────────────────────────────────────────────────┐
│ Board ▸ PROJ-123  │  In Progress  │  Marcus  │ Chat  IDE │
└──────────────────────────────────────────────────────────┘
```

- Left: breadcrumb trail (Board → Issue Key)
- Center: issue status badge + assignee
- Right: Chat / IDE tab switcher (highlights current view)

**Implementation**: A new `IssueContextBar` component rendered conditionally in `__root.tsx` when the route matches `/issue/$issueKey/*`.

**Files to create**:
- `src/components/shared/IssueContextBar.tsx`

**Files to modify**:
- `src/routes/__root.tsx` — render IssueContextBar between Header and content
- `src/routes/issue.$issueKey.chat.tsx` — remove redundant issue key display from chat header (it's now in the context bar)
- `src/routes/issue.$issueKey.ide.tsx` — remove redundant issue key from IDE header

---

### WS-4: Board Card Cleanup + Skeleton Loading

**Goal**: Reduce visual noise on board cards; add skeleton loading states.

**Card changes** (✅ User chose icon-only buttons):
- **Replace text action buttons** with **icon-only** variants — chat bubble icon and code bracket icon. Removes text labels "AI Chat" / "Open IDE" to reduce visual weight while keeping one-click access.
- Card footer becomes: `[💬] [</>]` — compact, recognizable, no text.
- Tooltip on hover reveals "AI Chat" / "Open IDE".

**Skeleton loading** — replace "Loading board..." spinner with gray placeholder columns and cards:
```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ ████████ │  │ ████████ │  │ ████████ │
│ ░░░░░░░░ │  │ ░░░░░░░░ │  │ ░░░░░░░░ │
│ ░░░░░░░░ │  │          │  │ ░░░░░░░░ │
│ ░░░░░░░░ │  │          │  │          │
└──────────┘  └──────────┘  └──────────┘
```

**Empty state warmth** — replace dashed border with subtle gradient background, warmer copy.

**Files to create**:
- `src/components/board/BoardSkeleton.tsx` — skeleton loading placeholder

**Files to modify**:
- `src/components/board/Card.tsx` — replace text buttons with icon-only buttons + tooltips
- `src/components/board/BoardView.tsx` — use BoardSkeleton instead of Loading spinner
- `src/components/shared/EmptyState.tsx` — update styling (remove dashed border, add gradient bg, warmer copy)

---

### WS-5: Settings Consolidation + IDE Panel Cleanup

**Goal**: Simplify settings tabs; remove non-functional IDE panel.

**Settings tabs**: 5 → 3
- **Integrations** (merge Connections + LLM) — all external service config in one place
- **Preferences** (merge Appearance + Telemetry) — personal settings
- **About** — stays (could be a footer link later)

**IDE right panel**: Remove the "AI Assistant" placeholder panel entirely. Give the editor the full remaining width. The chat is accessible via the context bar's Chat tab.

**Files to modify**:
- `src/routes/settings.tsx` — merge tabs
- `src/components/ide/IDELayout.tsx` — remove right panel

---

## Implementation Sequence

1. **WS-1** first (visual tokens) — all subsequent work builds on the new palette
2. **WS-4** next (card cleanup + skeleton) — immediate visual improvement
3. **WS-5** next (settings + IDE cleanup) — quick wins, reduces code
4. **WS-2** next (launchpad) — new feature, depends on WS-1 styling
5. **WS-3** last (context bar) — most complex, needs routing integration

## Verification
- `npm run test` — 305 tests pass after each workstream
- Dev server — visual check of each route in light and dark mode
- Mobile viewport — verify responsive behavior preserved
- Accessibility — verify skip nav, ARIA, keyboard nav still work
