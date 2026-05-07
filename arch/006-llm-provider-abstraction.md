# ADR-006: LLM Provider Abstraction

## Status: Accepted

## Context

Aegis needs to support multiple LLM providers to serve two distinct user classes:

- **Red Hat employees** use Claude via Vertex AI, authenticated with Google OAuth managed by the Service Worker.
- **Outside contributors** bring their own provider: Anthropic API key, OpenAI API key, local Ollama, or a custom OpenAI-compatible endpoint.

Each provider has different APIs, authentication mechanisms, streaming formats, and capabilities (particularly around tool use). The AI chat interface must work identically regardless of which provider is active, degrading gracefully when a provider lacks features like tool use.

Key forces:

- **Streaming is essential**: responses must appear token-by-token, not after full generation. Users expect this from every modern AI interface.
- **Tool use varies**: Anthropic and OpenAI support function calling natively; Ollama and many open-source models do not.
- **Security**: API keys must never be accessible to page JavaScript. They are stored in the Service Worker scope.
- **Provider switching**: a user may change providers or models mid-session without losing chat history.

## Decision

### 1. LLMProvider interface with AsyncIterable streaming

All providers implement a single `LLMProvider` interface whose `chat()` method returns `AsyncIterable<ChatChunk>`. This design was chosen over callbacks or Observable patterns because:

- `AsyncIterable` composes naturally with `for await...of` loops.
- It provides built-in backpressure (the consumer controls iteration pace).
- It works with `AbortController` for cancellation.
- It requires no additional dependencies.

```typescript
interface LLMProvider {
  id: string;
  name: string;
  models: ModelInfo[];
  supportsToolUse: boolean;
  supportsStreaming: boolean;
  maxContextWindow: number;
  chat(params: ChatParams): AsyncIterable<ChatChunk>;
}
```

### 2. SSE parsing via fetch + ReadableStream (not EventSource)

We parse streaming responses using `fetch()` + `ReadableStream.getReader()` rather than the browser's `EventSource` API because:

- `EventSource` only supports GET requests. All LLM APIs require POST.
- `ReadableStream` works identically for SSE (Anthropic, OpenAI) and NDJSON (Ollama).
- We can handle partial chunks, connection drops, and malformed data with a single parser architecture.
- Custom headers (API keys, auth tokens) are straightforward with `fetch()`.

Each provider has a dedicated stream parser (`parseAnthropicStream`, `parseOpenAIStream`, `parseOllamaStream`) that accepts a `Response` and yields `ChatChunk` values. All parsers share a common `readSSELines` utility that handles buffering partial reads.

### 3. Tool use degradation

When a provider does not support tool use:

- Organizational context (coding standards, testing guidelines, architecture docs) is **inlined into the system prompt** rather than served via tool calls.
- The `search()` and `execute()` MCP proxy tools are unavailable.
- The UI displays a capability indicator ("Full AI features" vs "Chat only").
- The `buildSystemPrompt` function checks `provider.supportsToolUse` and adjusts its output accordingly.

This ensures that chat is always functional regardless of provider capabilities, while providers with tool use get a richer experience.

### 4. Provider selection UX

Outside contributors see a `ProviderPicker` dialog on first AI use:

- Lists available providers with capability badges (Tool Use, Streaming).
- Collects API key or endpoint URL as needed.
- Offers a "Test Connection" button before saving.
- Stores the selection in the provider registry.

Red Hat employees skip this flow entirely — Vertex AI is configured automatically via Google OAuth.

### 5. Service Worker LLM relay and API key security

Provider classes do **not** hold API keys or call provider endpoints directly. Instead, all LLM requests route through the Service Worker's relay:

1. Provider classes `fetch()` to `/_aegis/llm/{provider}/{path}` (e.g., `/_aegis/llm/anthropic/v1/messages`).
2. The SW's `handleLLMRelay()` rewrites the URL to the actual provider endpoint (e.g., `https://api.anthropic.com/v1/messages`).
3. The SW injects the correct auth header from its in-memory token `Map`:
   - Anthropic: `x-api-key: {token}`
   - OpenAI/Custom: `Authorization: Bearer {token}`
   - Vertex AI: `Authorization: Bearer {google_oauth_token}`
4. API keys are sent to the SW via `sendTokenToSW()` at provider registration time and held only in SW memory.

This ensures page JavaScript **never** holds API keys after initial setup. An XSS attack cannot exfiltrate keys because they exist only in the SW's isolated scope. This is consistent with ADR-004 (Auth Architecture) which established the SW as the secure token store.

## Consequences

**Positive:**

- A single `ChatView` component works with any provider — no provider-specific UI code.
- Adding a new provider requires only implementing the `LLMProvider` interface and a stream parser (if the format differs from existing ones).
- Tool use degradation is invisible to the user — the system prompt compensates automatically.
- `AsyncIterable` enables clean streaming code without callback pyramids or state machines.
- The provider registry is a simple in-memory singleton — no complex dependency injection.

**Negative:**

- Each provider has a separate stream parser, which means parsing logic to maintain across 3 formats (Anthropic SSE, OpenAI SSE, Ollama NDJSON).
- Inlining org context in the system prompt for non-tool-use providers consumes context window tokens that could otherwise be used for conversation.
- The "Test Connection" in the provider picker is a heuristic (checking for valid key format or endpoint reachability), not a full end-to-end verification.
- Vertex AI may require a CORS proxy (see design doc risk 13.7), which would need a thin relay service — contradicting the zero-infrastructure principle.

## Alternatives Considered

- **EventSource API**: Built-in browser SSE support. Rejected because it only supports GET requests, and all LLM APIs require POST with a JSON body.
- **WebSocket-based streaming**: Would require a backend relay. Rejected to maintain the zero-infrastructure architecture.
- **Single "OpenAI-compatible" provider for everything**: Some providers (Anthropic, Ollama) have subtle API differences that an OpenAI shim would paper over, losing features like native tool use format. Rejected in favor of purpose-built providers with shared parsing infrastructure.
- **Observable/RxJS for streaming**: Adds a dependency and learning curve. `AsyncIterable` is a language primitive that achieves the same result. Rejected for simplicity.
- **Storing API keys in encrypted localStorage**: Encryption key would also be in page JS, so an XSS attacker could decrypt. This is security theater. Rejected in favor of SW-scoped storage (consistent with ADR-004).

## Implementation Notes (added post-UAT)

1. **AbortSignal support**: All five providers (Anthropic, OpenAI, Vertex AI, Ollama, Custom) now pass `params.signal` to their `fetch()` calls. Pressing Escape or clicking the Stop button in the chat UI triggers `AbortController.abort()`, which cancels the in-flight HTTP connection for all providers.

2. **Error recovery UX**: Chat streaming errors are no longer appended inline as markdown text. Instead, the `ChatMessage` type has an `error?: string` field. Errors render as a distinct banner below the message with a "Retry" button. The `error` field is transient — stripped before persisting to IndexedDB.

3. **Provider switching mid-session**: The `ChatView.handleProviderSelected` callback now correctly uses `switchProvider()` and `switchModel()` when a session already exists, rather than silently failing via `createSession()`'s early return.

4. **Custom provider error fix**: The `CustomProvider` error message was referencing `this.endpoint` (undefined) — corrected to `this.relayUrl`.

5. **Persona-aware system prompt**: `buildSystemPrompt()` accepts an optional `persona` param with `role` and `description`. When set, the LLM is addressed as "an AI assistant helping a {role}" with role-specific focus (e.g., "Focus on test coverage" for QA, "Focus on scope and dependencies" for PM). Suggested prompts in the chat empty state are also role-specific via `getSuggestedPrompts()` in `src/lib/llm/persona-prompts.ts`.

6. **Non-issue-scoped chat**: The `/chat` route provides a general AI chat surface without issue context. `issueKey` and `issueSummary` are now optional in `SystemPromptParams`. When absent, the system prompt omits issue fields and uses broader organizational context.
