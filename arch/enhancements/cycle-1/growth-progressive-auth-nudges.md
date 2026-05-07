# Feature: Progressive Auth Nudges with Inline Provider Setup

## User Story
As a first-time outside contributor, I want to connect my LLM provider and GitHub account at the exact moment I need them -- with minimal friction and without leaving my current context -- so that I can reach a productive state in under 60 seconds.

## Problem
The design doc specifies "progressive auth" (section 4.3) -- auth acquired lazily when the user first accesses a feature. The current implementation partially supports this pattern but has critical gaps that create friction for outside contributors:

1. **LLM provider setup is disruptive**: When a contributor opens AI Chat for the first time, the `ProviderPicker` dialog appears as a modal that blocks the entire view. The user has no context about why they need to configure a provider, what each option costs, or which one to pick. This is the single highest-friction moment in the outside contributor journey, and it happens at the exact moment the user is most curious about Aegis's value proposition.

2. **Auth failures show technical errors**: When `authManager.requireAuth()` throws, the caller currently has no standardized way to present a friendly auth prompt. The board view shows "Failed to load board" with the raw error message. The IDE would show similar technical errors.

3. **No "just works" default for outside contributors**: Unlike Red Hat employees who get Vertex AI automatically, outside contributors must manually configure an LLM provider. There is no recommended default, no cost guidance, and no "get started in 10 seconds" path.

4. **Onboarding wizard is disconnected from workflow**: The `OnboardingWizard` component exists but is a standalone multi-step modal that tries to connect everything upfront. This contradicts the progressive auth design and front-loads friction.

Evidence from comparable tools:
- **Cursor** detects local Ollama installations and auto-configures them. It also offers a free tier with limited completions so users never hit a setup wall.
- **Windsurf** provides free AI credits for new users to eliminate the provider-setup friction entirely.
- **Linear** uses progressive disclosure -- features reveal themselves as the user needs them, never all at once.

## Proposed Solution

### 1. Inline Auth Prompts (Replace Modal Blocking)
When a feature requires auth that the user hasn't provided, show a non-modal, inline prompt within the view itself rather than blocking with a dialog:

**AI Chat inline prompt**: Instead of the ProviderPicker modal appearing immediately, render a friendly card within the chat message area:
```
+-----------------------------------------------+
|  Set up AI to get started                      |
|                                                |
|  Aegis AI knows your team's coding standards   |
|  and this issue's requirements. Pick a         |
|  provider to start chatting.                   |
|                                                |
|  [Ollama (Free, Local)]  [Anthropic]  [OpenAI] |
|                                                |
|  Recommended: Ollama -- free, runs locally,    |
|  no API key needed. Just install and go.       |
+-----------------------------------------------+
```

Clicking a provider expands the card inline to show the API key input (or endpoint input for Ollama), a "Test" button, and a "Save" button -- all without leaving the chat view. No dialog. No page navigation. The user stays in context.

**Board inline prompt**: When Jira auth is missing, show an inline card in the board area (not a modal) explaining: "Connect Jira to load your team's board. Your data stays in your browser."

**IDE inline prompt**: When GitHub auth is missing, show an inline card in the editor panel explaining the auth requirement with a single-click "Connect GitHub" button.

### 2. Smart Provider Recommendation
Add auto-detection and recommendation logic to the provider setup flow:

- **Ollama detection**: On page load, make a `fetch('http://localhost:11434/api/tags')` call (fire-and-forget, fails silently). If Ollama is running locally, show it as "Detected -- click to connect" with a green indicator. This eliminates all setup friction for users who already have Ollama installed.
- **Recommended badge**: Show "Recommended for contributors" on Ollama (free, no key) and Anthropic (best tool-use support). Show cost estimates: "Ollama: Free", "Anthropic: ~$0.01/conversation", "OpenAI: ~$0.005/conversation".
- **Capability preview**: For each provider, show what features are available: "Full AI features" (tool use + streaming) vs. "Chat only" (no tool use).

### 3. Auth Redirect Preservation
When the user clicks "Connect GitHub" from an inline prompt and is redirected to the OAuth flow, preserve the return URL:

1. Before redirect: `sessionStorage.setItem('aegis_auth_return', window.location.href)`
2. After OAuth callback: read the stored URL and `router.navigate()` to it
3. The user lands back exactly where they were, with auth now connected and the feature ready to use

### 4. Deprecate the Upfront Onboarding Wizard
Replace the multi-step `OnboardingWizard` with a lightweight "welcome toast" that appears once after first GitHub auth:
- "Welcome to Aegis! Start by opening a board or clicking AI Chat on any issue."
- Dismiss after 8 seconds or on click
- No multi-step flow, no "Connect all accounts" pressure

The existing `OnboardingWizard.tsx` component should be retained but only triggered from a "Connect all accounts" link in Settings for users who prefer the batch approach.

## Impact Assessment
- User impact: **High** -- this directly reduces time-to-value for outside contributors from "minutes of configuration" to "seconds." The Ollama auto-detection alone could eliminate the setup wall for a significant portion of the developer audience who already run local models.
- Effort estimate: **M** -- inline auth prompt components are ~100 lines each. Ollama detection is ~15 lines. Auth redirect preservation is ~15 lines. Provider recommendation logic is ~30 lines. Total: ~300 lines of focused work across 6-8 files.
- Risk: Ollama detection via `fetch` to localhost may be blocked by browser CORS policies in some configurations. Mitigated by catching errors silently and falling back to the standard provider list. The `fetch` should use `mode: 'no-cors'` or a simple HEAD request.

## Competitive Analysis
| Tool | First-Time AI Setup | Auth Flow |
|---|---|---|
| Cursor | Auto-detects local models, free tier available | GitHub sign-in, then immediate use |
| Windsurf | Free credits for new users | Similar to Cursor |
| Linear | N/A (no AI feature requiring user setup) | Team invite link, instant access |
| github.dev | N/A | Uses existing GitHub session |
| GitHub Copilot | Subscription required, but embedded in editor | GitHub auth, seamless |
| **Aegis (today)** | Modal dialog, no guidance, no defaults | Progressive concept but modal execution |

## Technical Sketch

**New files:**
- `src/components/shared/InlineAuthPrompt.tsx` -- a reusable component that renders an inline card prompting for a specific auth provider. Props: `provider`, `context` (what feature needs it), `onConnected` callback. Uses existing Button/Card/Input from Shadcn.
- `src/components/chat/InlineProviderSetup.tsx` -- chat-specific inline LLM setup card with provider recommendations and Ollama detection. Renders within the MessageList area as a system-level card.
- `src/lib/llm/detect-ollama.ts` -- a `detectOllama(): Promise<{ available: boolean; models: string[] }>` function that probes localhost:11434. Fails gracefully.

**Modified files:**
- `src/components/chat/ChatView.tsx` -- when no provider is configured, render `InlineProviderSetup` in the message area instead of opening the `ProviderPicker` dialog. Keep `ProviderPicker` available via a "More options" link for users who want the full dialog.
- `src/components/board/BoardView.tsx` -- when Jira auth fails, render `InlineAuthPrompt` with `provider="atlassian"` instead of the generic error screen.
- `src/components/ide/IDELayout.tsx` -- when GitHub auth is missing, render `InlineAuthPrompt` with `provider="github"` in the editor panel.
- `src/lib/auth/manager.ts` -- add `setPendingRedirect(url)` and `consumePendingRedirect()` methods using `sessionStorage`.
- `src/components/shared/OnboardingWizard.tsx` -- no changes to the component itself, but its trigger point moves from automatic on first auth to manual from Settings page only.
- `src/routes/index.tsx` -- remove automatic onboarding wizard trigger; replace with the welcome toast pattern.

**Approach:**
- Inline prompts are composable: `InlineAuthPrompt` handles the generic case (render a card, show a connect button, call `authManager` on success). `InlineProviderSetup` extends this for the LLM-specific case with provider cards and Ollama detection.
- All inline prompts self-dismiss after successful auth/configuration -- the underlying view re-renders with the feature now available.
- No new npm dependencies.
