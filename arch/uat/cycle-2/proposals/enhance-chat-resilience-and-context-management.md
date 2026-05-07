# Proposal: Chat Resilience and Context Management

## Type: enhancement

## Source
**UAT findings addressed:**
- Power User C1 / Error Paths C1: Escape key "Stop Streaming" shortcut dispatches event that nothing listens for -- completely non-functional
- Power User C3: Provider switch after session exists silently fails -- `createSession` skips if session already exists
- Error Paths C4: Custom LLM provider references undefined `this.endpoint` in error message
- Error Paths C5: Vertex AI, Ollama, and Custom providers do not pass AbortSignal to fetch -- stop button does not abort underlying request
- Error Paths U4: Chat streaming loop does not handle mid-stream network drops gracefully (error embedded in message text)
- Error Paths U5: Concurrent chat sends not prevented (TOCTOU gap)
- New Contributor U2: Chat page uses hardcoded mock issue data instead of real Jira data
- New Contributor U3: ProviderPicker sends API key with wrong provider type casting
- New Contributor U5: Dismissing ProviderPicker leaves user stuck with disabled input and no way to re-open
- New Contributor P7: No loading or error state in ProviderPicker "Test Connection" for API key providers
- Power User P1: No `Cmd+/` shortcut to focus the chat input

**Cycle 1 features addressed:**
- **platform-llm-context-budget** (5/5 approved): Token budget calculator, conversation compaction strategy, system prompt budget cap, provider-specific overflow handling
- **growth-progressive-auth-nudges** (5/5 approved, partially): Inline provider setup with recommendations replacing the modal ProviderPicker as the default first-time experience in chat

## Problem
The chat system has multiple interacting failures: the Escape-to-stop shortcut dispatches an event nobody listens for, 3 of 5 LLM providers do not pass AbortSignal so Stop does not actually abort the fetch, provider switching is silently ignored, the system prompt uses fake mock data, token type casting is unsafe, and there is no context window management (conversations grow without bound until they hit provider-specific errors). Mid-stream errors are embedded in message text rather than shown as distinct UI. Dismissing the provider picker leaves the chat in an unusable state.

## Solution

### 1. Fix Escape-to-stop streaming
- In `ChatView.tsx`, add a `useEffect` that registers an event listener for `aegis:stop-streaming` and calls `handleStop()` (which triggers `abortRef.current?.abort()`). Clean up on unmount.
- Alternative (simpler): remove the custom event dispatch from the chat route's Escape shortcut handler and instead call `handleStop` directly by exposing it via a ref or store action.

### 2. Pass AbortSignal to all providers
- In `src/lib/llm/providers/vertex.ts`, add `signal: params.signal` to the `fetch()` call.
- In `src/lib/llm/providers/ollama.ts`, add `signal: params.signal` to the `fetch()` call.
- In `src/lib/llm/providers/custom.ts`, add `signal: params.signal` to the `fetch()` call. Also fix the error message at line 137 to reference `this.relayUrl` instead of `this.endpoint`.

### 3. Fix provider switching
- In `ChatView.tsx` `handleProviderSelected`, call `chatStore.switchProvider(issueKey, providerId, modelId)` instead of `createSession()`. The `switchProvider` action already exists at `stores/chat.ts:164` but is never invoked from the UI.

### 4. Fix ProviderPicker type safety and dismissal
- In `ProviderPicker.tsx:202`, replace `as 'github'` cast with a proper union type that includes LLM provider IDs, or use a separate `sendLLMKeyToSW()` function that accepts the correct types.
- When the ProviderPicker is dismissed without selection, show a persistent inline message in the chat area: "No AI provider configured. [Set up a provider] to start chatting." with a button to re-open the picker.
- Add actual API validation to "Test Connection": make a lightweight API call (e.g., list models endpoint) and show success/failure feedback with a loading spinner.

### 5. Replace mock issue data with real Jira data
- In `issue.$issueKey.chat.tsx`, replace `getMockIssue()` with a TanStack Query hook that fetches the real issue from Jira (via `jiraClient.getIssue(issueKey)`). When Jira is not connected, show the context panel with just the issue key and a note that Jira data is unavailable, rather than fabricated data.
- Update the system prompt assembly in `system-prompt.ts` to handle the case where issue data is unavailable (use just the issue key).

### 6. Token budget manager
- Create `src/lib/llm/token-budget.ts` with a character-based token estimator (~4 chars/token for English, ~3 for code).
- Calculate budget: `availableForMessages = contextWindow - systemPromptTokens - outputReserve(4096)`.
- When messages exceed 75% of budget, apply Phase 1 compaction: replace tool results older than 10 messages with a summary line `[Tool result truncated: {toolName}, {charCount} chars]`.
- When messages exceed 90% of budget, apply Phase 3: drop oldest messages (keep system prompt + last 10 messages), show a toast notification.
- Display a subtle token usage indicator near the chat input: "Context: 45K / 200K".

### 7. Mid-stream error handling
- In `ChatView.tsx`, when the streaming loop catches a network error, instead of appending the error text to the message content, mark the message as `status: 'error'` and store the error separately. Render a distinct error banner below the truncated message with a "Retry" button.

### 8. Concurrent send prevention
- In `ChatView.tsx` `handleSend`, add a local ref `isSending` that is checked and set synchronously before any async work. This eliminates the TOCTOU gap between the click and the `isStreaming` state update.

### 9. Chat input focus shortcut
- Register `mod+/` in the chat scope to focus the message textarea. Expose the textarea ref from `MessageInput` via `forwardRef` or a callback prop.

## Effort: M

## Files affected
- `src/components/chat/ChatView.tsx` (escape listener, provider switch fix, error handling, concurrent send guard, focus shortcut)
- `src/components/chat/MessageInput.tsx` (expose ref for focus shortcut)
- `src/components/chat/ProviderPicker.tsx` (type safety fix, test connection validation, dismissal UX)
- `src/components/chat/MessageList.tsx` (distinct error rendering for truncated messages)
- `src/lib/llm/providers/vertex.ts` (pass AbortSignal)
- `src/lib/llm/providers/ollama.ts` (pass AbortSignal)
- `src/lib/llm/providers/custom.ts` (pass AbortSignal, fix error message)
- `src/lib/llm/token-budget.ts` (new -- token estimation, budget calculation, compaction)
- `src/lib/llm/system-prompt.ts` (budget cap for org context)
- `src/stores/chat.ts` (token tracking, compaction action)
- `src/routes/issue.$issueKey.chat.tsx` (replace mock data with real Jira query, register focus shortcut)

## Test plan
- Verify pressing Escape during streaming stops the response (check abortRef.abort is called)
- Verify Vertex AI, Ollama, and Custom providers abort the underlying fetch when Stop is clicked (mock fetch, verify signal.aborted)
- Verify switching from Anthropic to OpenAI mid-session actually changes the provider (send a message after switch, verify it uses the new provider)
- Verify dismissing ProviderPicker shows an inline "Set up a provider" prompt with a re-open button
- Verify "Test Connection" for Anthropic makes a real API validation call and shows loading/success/failure states
- Verify chat context panel shows real Jira data when Jira is connected, and a "data unavailable" note when not connected (not fake mock data)
- Verify custom provider error message shows the actual relay URL, not "undefined"
- Token budget test: create a long conversation (50+ messages), verify old tool results are compacted and a token usage indicator is displayed
- Verify mid-stream network drop shows a distinct error banner (not embedded in message text) with a "Retry" button
- Verify rapid double-click on Send does not create duplicate messages
- Verify `Cmd+/` focuses the chat textarea from anywhere on the chat page
