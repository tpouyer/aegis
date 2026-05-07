# Feature: Interactive Playground Mode (No-Auth Preview)

## User Story
As a prospective contributor visiting Aegis for the first time, I want to explore the board, chat, and IDE with realistic sample data before connecting any accounts so that I can understand the product's value without upfront commitment.

## Problem
The current landing page (`routes/index.tsx`) shows three static feature cards and immediately funnels users toward auth. A first-time visitor who lands on Aegis has no way to experience the kanban board, AI chat, or IDE without first providing GitHub credentials or an LLM API key. This creates a high-friction "cold start" that kills adoption before the user understands the value.

Evidence from comparable tools:
- **Linear** provides a public sandbox workspace that prospective users can explore with pre-loaded demo data, no sign-up required.
- **GitHub Projects** is visible on any public repo without auth.
- **Cursor** and **Windsurf** both offer a "try before you sign up" experience with local file editing on first launch.
- **github.dev** opens instantly on any public repo by pressing `.` -- zero auth for read-only browsing.

The design doc already defines a Guest auth tier with access to public content, but the current implementation offers no meaningful Guest experience.

## Proposed Solution
Add a "Try it now" button on the landing page that loads a self-contained playground mode:

1. **Sample board**: A static kanban board with 8-12 realistic Jira-like cards across 4 columns (Backlog, In Progress, Review, Done). Cards are draggable. Clicking a card shows the detail panel with a mock issue description and acceptance criteria. No Jira API calls.

2. **Sample chat**: Clicking "AI Chat" on a playground card opens the chat view pre-populated with a 3-4 message conversation demonstrating org-context-aware responses (coding standards, testing guidelines). The input is disabled with a prompt: "Connect an LLM provider to start chatting." This showcases the system prompt assembly and tool-use capabilities without requiring an API key.

3. **Sample IDE**: Clicking "Open IDE" on a playground card opens the IDE with a small pre-loaded file tree (5-6 files) and a sample file in the Monaco editor. The file explorer, tabs, and diff view all function. Commits are disabled with a prompt to connect GitHub.

4. **Playground banner**: A persistent, dismissible banner at the top reads: "You are viewing sample data. Connect your accounts to work with real projects." with a "Get Started" CTA that opens the onboarding wizard.

5. **URL routing**: Playground lives at `/playground` with sub-routes `/playground/board`, `/playground/chat`, `/playground/ide`. No conflict with authenticated routes.

Sample data is bundled as a static JSON fixture (~5KB), loaded synchronously -- no network calls.

## Impact Assessment
- User impact: **High** -- directly addresses the #1 adoption blocker (no value demonstration before auth). Every comparable tool in this space provides a try-before-you-buy experience.
- Effort estimate: **M** -- requires a playground route, static fixtures, and conditional rendering in existing BoardView/ChatView/IDELayout components to accept injected data. No new UI primitives needed; reuses all existing components.
- Risk: Users may confuse playground data with real data. Mitigated by the persistent banner and visual differentiation (e.g., a subtle background tint or "SAMPLE" watermark on cards).

## Competitive Analysis
| Tool | Pre-auth Experience | Notes |
|---|---|---|
| Linear | Public sandbox workspace | Full interactivity with sample data |
| GitHub Projects | Read-only on public repos | No auth for viewing |
| github.dev | Full editor on public repos | Press `.` on any repo, instant IDE |
| Cursor | Local editor, no sign-up | AI features require auth, but editor works |
| Windsurf | Local editor, no sign-up | Similar to Cursor approach |
| Shortcut | Screenshot-based demo | Lower fidelity than interactive |
| **Aegis (today)** | Static feature cards | No interactivity without auth |

## Technical Sketch

**New files:**
- `src/routes/playground.tsx` -- playground root route with sub-routes
- `src/lib/fixtures/playground-data.ts` -- static sample board, issues, chat messages, and file tree

**Modified files:**
- `src/components/board/BoardView.tsx` -- accept an optional `staticData` prop that bypasses TanStack Query hooks and uses injected data instead
- `src/components/chat/ChatView.tsx` -- accept an optional `demoMessages` prop that renders a pre-populated conversation with input disabled
- `src/components/ide/IDELayout.tsx` -- accept an optional `staticFiles` prop that provides a pre-loaded VFS without GitHub API calls
- `src/routes/index.tsx` -- add "Try it now" button linking to `/playground`
- `src/components/shared/Sidebar.tsx` -- show playground link for Guest users

**Approach:**
- Each component checks for the presence of static data props. When present, it skips network fetches and renders from the fixture. When absent, existing behavior is unchanged.
- Playground route wraps existing components with fixture data injection -- no duplication of UI code.
- Monaco editor in playground mode loads a bundled sample file (plain string) rather than fetching from GitHub API.
