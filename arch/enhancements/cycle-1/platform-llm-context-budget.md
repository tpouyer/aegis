# Feature: LLM Context Window Budget Manager

## User Story
As a developer using Aegis AI chat, I want the system to intelligently manage the context window so that my conversations do not silently truncate important context or fail with token limit errors.

## Problem
The current chat implementation (`stores/chat.ts`, `lib/llm/system-prompt.ts`) assembles a system prompt from issue details + org context and appends the full message history on every request. There is no token counting or context window management:

1. **No token awareness.** The `ChatParams` type has `maxTokens` for output, but there is no accounting for input tokens. The `LLMProvider` interface exposes `maxContextWindow` but nothing reads it. A conversation with 50+ messages, multiple tool call/result pairs, and a large system prompt can easily exceed the model's context window.
2. **Silent failure modes.** When context exceeds the window, different providers behave differently: Anthropic returns a 400 with "prompt is too long"; OpenAI silently truncates from the beginning; Ollama may crash or produce garbage. None of these are handled in the stream parsers.
3. **No conversation compaction.** Long conversations accumulate tool results that were useful once but are now irrelevant (e.g., a `coding_standards` tool result from 30 messages ago). There is no mechanism to summarize or prune old context.
4. **Org context competes with conversation.** The system prompt injects all resolved org context upfront (for providers without tool use). For a repo with extensive coding standards, testing guidelines, and architecture docs, this could consume 30-50% of the context window before the user even types a message.

The `ChatSession.messages` array grows without bound in `appendStreamChunk` and `addMessage`. For a multi-hour coding session, this is a ticking time bomb.

## Proposed Solution

### 1. Token budget calculator
Add a lightweight token estimator that works for all providers:
- For Anthropic/OpenAI: use a simple character-based heuristic (1 token ~ 4 characters for English, 3 for code). This is accurate to within 10%, which is sufficient for budget planning.
- Expose the budget as: `availableForMessages = contextWindow - systemPromptTokens - toolDefinitionTokens - outputReserve`.
- Display the budget in the chat UI as a progress bar: "Context: 45,000 / 200,000 tokens used."

### 2. Conversation compaction strategy
When the message history exceeds 75% of the available budget:
- **Phase 1: Tool result pruning.** Replace old tool results (>10 messages ago) with a summary: `[Tool result from coding_standards: 2,400 chars, truncated]`. Keep the tool call itself so the AI knows it was invoked.
- **Phase 2: Message summarization.** Summarize the oldest N messages into a single system message: "Previous conversation summary: [AI-generated summary]". This requires an LLM call but uses a small/fast model or the same model with a short max_tokens.
- **Phase 3: Hard truncation.** If still over budget after phases 1-2, drop the oldest messages (keeping the system prompt and the last 10 messages). Show a toast: "Older messages were removed to fit the context window."

### 3. System prompt budget cap
Reserve a maximum of 30% of the context window for the system prompt (issue context + org context). If the org context exceeds this cap:
- Prioritize by relevance: issue description > acceptance criteria > coding standards for the specific repo > general architecture docs.
- Truncate lower-priority sections with a note: "[Architecture docs truncated -- invoke the `architecture` tool for full content]".

### 4. Provider-specific overflow handling
Add error handling in the stream parsers for context overflow errors:
- Anthropic 400 "prompt is too long": trigger emergency compaction (phase 3) and auto-retry.
- OpenAI 400 "maximum context length exceeded": same.
- Surface the compaction event to the user: "Context was too large -- older messages have been summarized."

## Impact Assessment
- **User impact:** High -- prevents the most confusing failure mode in AI chat (silent context truncation or cryptic API errors mid-conversation). Enables longer, more productive sessions.
- **Effort estimate:** M -- token estimation is simple; the compaction logic requires careful ordering. The AI-powered summarization (phase 2) adds complexity but is optional for the initial implementation (phases 1 and 3 alone provide significant value).
- **Risk:** Token estimation is approximate. Under-estimation could still cause overflow; over-estimation could compact too aggressively. Mitigate by using a 10% safety margin. The summarization step introduces an additional LLM call, which adds latency and cost. Make it opt-in or defer to phase 2 of this enhancement.

## Competitive Analysis
- **VS Code Copilot Chat:** VS Code's Copilot Chat uses a "context budget" system that prioritizes recent messages and active file content. Old messages are summarized. The `#` references (e.g., `#file`, `#selection`) are ranked by relevance and truncated from lowest priority.
- **ChatGPT:** ChatGPT uses server-side conversation compaction for long threads. Users see "This conversation may be too long -- some earlier messages may be summarized." The web UI shows a token usage indicator in the model picker.
- **Cursor (AI code editor):** Cursor implements aggressive context management: it selects which files to include based on relevance scoring and truncates less-relevant files first. The "long context" mode explicitly shows how much context is being used.
- **Slack AI:** Slack's AI summarization feature manages context by summarizing channel history into a fixed budget before presenting to the LLM.

## Technical Sketch
### New files
- `lib/llm/token-budget.ts` -- token estimation, budget calculation, and compaction orchestration.
- `lib/llm/compactor.ts` -- conversation compaction strategies (tool pruning, summarization, hard truncation).

### Modified files
- `lib/llm/types.ts` -- add `estimatedTokens` field to `ChatMessage`. Add `contextBudget` to `ChatParams`.
- `stores/chat.ts` -- track running token count in `ChatSession`. Trigger compaction when approaching 75% of budget. Add `compactSession(issueKey)` action.
- `lib/llm/system-prompt.ts` -- accept a `maxTokens` parameter; truncate org context sections by priority when over budget.
- `lib/llm/stream-parser.ts` -- detect "prompt too long" errors in Anthropic and OpenAI parsers; emit a new `ChatChunk.type = 'context_overflow'`.
- `components/chat/ChatView.tsx` -- add a context usage indicator (progress bar or "X / Y tokens"). Show compaction notifications.
- `components/chat/MessageList.tsx` -- visually distinguish summarized/compacted messages from original ones.

### Not affected
- No WASM engine changes.
- No Service Worker changes.
- No build pipeline changes.
