# Aegis UAT Refinement Loop

Run this prompt after starting the dev server (`cd packages/app && npm run dev`). It launches parallel user-acceptance testing agents, triages findings through PM agents, votes on proposals, implements approved changes, and repeats — continuously refining the application until interrupted.

## Prerequisites
- Dev server running on localhost (run `cd packages/app && npm run dev` first)
- All tests passing (`npm run test` from packages/app, `cargo test` from packages/engine)
- `--dangerously-skip-permissions` flag enabled

---

## Prompt

```
You are the orchestrator for a continuous UAT refinement loop on the Aegis project at /Users/tpouyer/Projects/aegis. The dev server should already be running. If not, start it with `cd packages/app && npm run dev` in the background.

Your job is to repeat this cycle until I interrupt you:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1: USER ACCEPTANCE TESTING (5 parallel UAT agents)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Launch 5 agents in parallel, each with a distinct user persona. Each agent must:
1. Read the codebase (routes, components, stores, libs) to understand the UI
2. Open the running app via WebFetch to localhost and evaluate the rendered pages
3. Trace user journeys through the code, checking for broken flows, missing error handling, confusing UX, accessibility gaps, and edge cases
4. Write findings to `arch/uat/cycle-N/` (where N is the current cycle number)

**Agent UAT-1: "New Outside Contributor"**
- Persona: First-time visitor, no accounts connected, wants to contribute to an open-source Ansible project
- Test: Landing page → understand value prop → try board without auth → get guided to connect GitHub → attempt AI chat with own API key → open IDE → make an edit → attempt commit
- Focus: Onboarding friction, clarity of empty states, auth flow discoverability, error messages when unauthenticated
- Write findings to `arch/uat/cycle-N/uat-new-contributor.md`

**Agent UAT-2: "Red Hat Power User"**
- Persona: Senior RH engineer who uses Aegis daily, all accounts connected, working on multiple issues
- Test: Board filtering → drag card to transition → open AI chat on an issue → switch models → use keyboard shortcuts → Cmd+K command palette → open IDE → edit multiple files → commit → create PR
- Focus: Keyboard navigation completeness, workflow speed, state consistency across route transitions, multi-tab behavior
- Write findings to `arch/uat/cycle-N/uat-power-user.md`

**Agent UAT-3: "Accessibility Auditor"**
- Persona: User relying on keyboard-only navigation and screen reader
- Test: Every route and interactive component for WCAG 2.1 AA compliance
- Focus: Focus management, ARIA attributes, color contrast, keyboard traps, screen reader announcements, skip links, heading hierarchy
- Write findings to `arch/uat/cycle-N/uat-accessibility.md`

**Agent UAT-4: "Error Path Explorer"**
- Persona: Chaos engineer trying to break the app
- Test: Network failures mid-stream, expired tokens, API rate limits, empty responses, malformed data, rapid clicking, navigation during async operations, browser back/forward, concurrent mutations
- Focus: Error recovery, loading states, race conditions, zombie listeners, memory leaks, stale closures
- Write findings to `arch/uat/cycle-N/uat-error-paths.md`

**Agent UAT-5: "Mobile & Performance Tester"**
- Persona: Developer on a slow connection with a small viewport
- Test: Responsive layout, touch targets, bundle size, lazy loading boundaries, large data sets (100+ board cards, long chat histories, big file trees)
- Focus: Layout breakpoints, scroll performance, initial load time, memory growth over time, service worker caching effectiveness
- Write findings to `arch/uat/cycle-N/uat-performance.md`

Each UAT agent writes findings in this format:
```markdown
# UAT: [Persona Name] — Cycle N

## Critical Issues (blocks user journey)
### C1: [title]
- **Journey step**: what the user was trying to do
- **Expected**: what should happen
- **Actual**: what the code does (with file:line references)
- **Impact**: who is affected and how badly

## UX Issues (confusing or frustrating)
### U1: [title]
- **Journey step / Expected / Actual / Impact**

## Polish Items (works but could be better)
### P1: [title]
- **Suggestion**: what to improve

## Positive Observations
- What works well that should be preserved
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2: TRIAGE & PROPOSALS (3 parallel PM agents)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After all 5 UAT agents complete, read ALL their findings. Then launch 3 PM agents in parallel:

**PM-Fix**: Triages all Critical and UX issues into concrete fix proposals. Each fix gets:
- Root cause analysis (file:line)
- Proposed fix (specific code changes)
- Effort estimate (S/M/L)
- Write to `arch/uat/cycle-N/proposals/fix-{slug}.md`

**PM-Enhance**: Reviews Polish items and identifies enhancement opportunities. Cross-references against the 10 approved-but-unimplemented features from Enhancement Cycle 1 (`arch/enhancements/cycle-1/vote-results.md`). Proposes enhancements that address multiple UAT findings at once. Write to `arch/uat/cycle-N/proposals/enhance-{slug}.md`

**PM-Systemic**: Looks for systemic patterns across all 5 UAT reports. If 3+ reports flag related issues, proposes an architectural fix rather than point fixes. Write to `arch/uat/cycle-N/proposals/systemic-{slug}.md`

Each proposal uses:
```markdown
# Proposal: [Name]
## Type: fix | enhancement | systemic
## Source: [which UAT findings this addresses, e.g. UAT-1 C2, UAT-3 U1]
## Problem: [1-2 sentences]
## Solution: [specific changes with file paths]
## Effort: S | M | L
## Files affected: [list]
## Test plan: [how to verify the fix]
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3: DEMOCRATIC VOTE (5 parallel voting agents)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Launch 5 voting agents in parallel — same panel as Enhancement Cycle 1:

| Voter | Persona | Evaluates For |
|-------|---------|---------------|
| V1 | Staff Engineer | Technical feasibility, code quality, maintenance burden |
| V2 | UX Designer | User experience impact, accessibility, interaction patterns |
| V3 | Security Engineer | Security implications (VETO power on reject) |
| V4 | Product Strategist | User value, vision alignment, differentiation |
| V5 | QA Lead | Testability, regression risk, edge case coverage |

Each voter reads ALL proposals and writes ballots to `arch/uat/cycle-N/votes/v{N}-{role}.md`:
```markdown
## [proposal-filename]
- **Verdict**: APPROVE / REJECT / ABSTAIN
- **Reasoning**: [2-3 sentences]
- **Conditions**: [requirements if approved]
```

Rules:
- Majority (3+ of 5 APPROVE) → proceeds to implementation
- Security Engineer REJECT = automatic veto
- All Critical fixes (type: fix, source: C*) get fast-tracked — they only need 2/5 to proceed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 4: IMPLEMENT APPROVED PROPOSALS (parallel agents)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Tally votes and write results to `arch/uat/cycle-N/vote-results.md`
2. For each approved proposal, launch an implementation agent (up to 4 in parallel, non-overlapping files)
3. Each agent:
   - Reads the proposal and referenced UAT findings
   - Implements the fix/enhancement with tests
   - Ensures `npm run test` passes
   - Does NOT commit
4. After all agents complete:
   - Run full test suite (`npm run test` + `cargo test`)
   - Run `npm run build` to verify production build
   - Fix any test failures
   - Launch 1 adversarial review agent to audit all changes
   - Fix any blockers from the review
   - Commit with descriptive message

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 5: REPEAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Write cycle summary to `arch/uat/cycle-N/summary.md`:
```markdown
# UAT Cycle N Summary
## Findings: X critical, Y UX issues, Z polish items
## Proposals: A fixes, B enhancements, C systemic
## Voted: D approved, E rejected
## Implemented: [list with test counts]
## Remaining: [what wasn't addressed]
## Trend: [are findings decreasing? what categories persist?]
```

Increment N and go back to Phase 1. The cycle ends when:
- The user interrupts with Ctrl+C or a message
- Two consecutive cycles produce zero Critical findings and fewer than 3 UX issues
- No proposals receive majority approval (the app is "good enough" by consensus)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONSTRAINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- All work stays on local disk — no git push, no Jira/GitHub mutations
- Web/API reads allowed for research
- Every implementation must include tests
- Every cycle gets an adversarial review before commit
- Track test count trend across cycles (should only go up)
- If the test suite breaks and can't be fixed in 3 attempts, skip that proposal and note it as blocked
- Between cycles, update CLAUDE.md if the architecture changes significantly
```

---

## Usage

```bash
# Terminal 1: Start dev server
cd /Users/tpouyer/Projects/aegis/packages/app && npm run dev

# Terminal 2: Run the refinement loop
claude --dangerously-skip-permissions -p "$(cat prompts/uat-refinement-loop.md)"
```

Or paste the prompt section (between the triple backticks) directly into a Claude Code session with permissions enabled.
