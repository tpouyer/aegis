# ADR-002: Frontend Tooling

## Status: Accepted

## Context

Aegis is a zero-infrastructure development platform served as a static SPA. The frontend must support code-splitting by route (board, chat, IDE are separate chunks), integrate with a WASM engine, and provide an accessible, consistent design system. We need a build tool, router, component library strategy, and state management approach that work together without imposing runtime infrastructure requirements.

## Decision

We selected the following stack:

**Build tool: Vite** — Vite provides fast HMR via native ESM in development and optimized Rollup-based production builds. Its first-class WASM support is critical for loading the Rust engine. The Tailwind CSS v4 Vite plugin integrates directly into the build pipeline without PostCSS configuration.

**Router: TanStack Router** — TanStack Router provides type-safe route definitions with compile-time parameter validation, file-based routing conventions that eliminate manual route registration, and built-in route-level code splitting via lazy loading. This is essential for keeping the initial bundle small (Monaco editor should only load on the IDE route).

**Component library: Shadcn UI (copy-paste) over traditional component libraries** — Rather than depending on a versioned component library (MUI, Chakra, Mantine), we use Shadcn's approach of copying component source code into the project. Components are built on Radix UI primitives for accessibility. This gives full ownership of the code, eliminates version lock-in, and allows customization without fighting library abstractions. The trade-off is manual maintenance of updates, but for a focused application this is manageable.

**State management: Zustand + TanStack Query** — These serve complementary roles. TanStack Query manages server state (Jira issues, GitHub data) with built-in caching, background refetching, and optimistic updates. Zustand manages client UI state (sidebar toggle, editor tab selection, drag-and-drop optimistic state). This separation avoids the common pattern of forcing server data through a client state manager.

## Consequences

**What becomes easier:**
- Route-level code splitting is automatic via TanStack Router's file-based conventions
- Component customization requires editing local files rather than fighting library overrides
- Server state caching and invalidation are handled declaratively by TanStack Query
- WASM loading integrates naturally through Vite's asset pipeline

**What becomes harder:**
- Shadcn components must be manually updated when upstream fixes bugs in Radix primitives
- TanStack Router's file-based conventions require understanding its naming rules (e.g., `$param` for dynamic segments)
- Two state management libraries (Zustand + Query) increase the surface area a new developer must learn

## Alternatives Considered

**Next.js / Remix** — Both impose server-side rendering assumptions and deployment requirements that conflict with the zero-infrastructure constraint. Aegis is a pure client-side SPA served from GitHub Pages.

**React Router** — Mature and widely used, but lacks type-safe route parameters and requires manual code-splitting setup. TanStack Router provides these out of the box.

**MUI / Chakra UI** — Full component libraries that provide more out of the box but come with version lock-in, bundle size overhead, and theming constraints that make deep customization difficult.

**Redux / Recoil** — Redux adds boilerplate for simple UI state; Recoil is less maintained. Zustand provides equivalent capability with minimal API surface. Neither addresses server state caching, which TanStack Query handles natively.

## Implementation Notes (added post-redesign)

**Design system**: The visual design now follows Red Hat's PatternFly 6 design language:
- **Colors**: PatternFly 6 palette (`#0066CC` primary blue, PF gray scale, `#B1380B` destructive). Red Hat Red (`#EE0000`) used only for brand identity, not interactive elements.
- **Typography**: Red Hat Display (headings), Red Hat Text (body), Red Hat Mono (code) loaded via Google Fonts with `preconnect` hints.
- **Sidebar**: Always-dark (`#151515`) matching PatternFly's masthead/navigation convention (console.redhat.com pattern).
- **Border radii**: Slightly rounder than defaults (md: 0.5rem, lg: 0.75rem, xl: 1rem) per PF6.
- **Zustand stores**: 8 stores — board, chat, IDE, theme, sidebar, telemetry, recent, persona. The persona store (`src/stores/persona.ts`) tracks the user's active role across 6 options (Developer, PM, QA, Architect, Manager, Support) and drives role-aware AI prompts, landing page widgets, and system prompt context.
- **Multi-persona UX**: The app adapts to non-developer personas. The system prompt, suggested chat prompts, and landing page widgets all vary by active role. A general chat route (`/chat`) serves users who need AI assistance without a specific issue context. A board table view offers PMs and managers a sortable, data-dense alternative to the kanban layout.
- **Linting**: Biome v2.4 (`biome.json`) replaces the need for ESLint + Prettier. Single Rust-based tool for both linting and formatting. CI enforces clean lint via `biome check`. Locally, `npm run format` auto-fixes.
- **CI/CD**: Three GitHub Actions workflows (`ci.yml`, `publish.yml`, `release.yml`). CI runs TypeScript strict checking (API contract validation), Biome lint, JS tests, Rust tests, and a full production build in parallel. Publish deploys to GitHub Pages. Release creates GitHub Releases on tag push.

**Webpack** — Slower development feedback loop, more complex configuration, and no first-class Tailwind v4 or WASM support. Vite is the standard choice for new React projects.
