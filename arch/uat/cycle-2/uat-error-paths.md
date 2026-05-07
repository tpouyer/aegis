# UAT: Error Path Explorer — Cycle 2

**Tested by**: Error Path Explorer persona (chaos engineer)
**Date**: 2026-05-07
**Focus**: Error recovery, loading states, race conditions, zombie listeners, memory leaks, stale closures

---

## Critical Issues (blocks user journey)

### C1: Escape key "Stop Streaming" shortcut dispatches event that nothing listens for

- **Journey step**: User is in the chat view, AI is streaming a response, user presses Escape to stop generation
- **Expected**: The streaming should stop immediately (AbortController.abort() is called)
- **Actual**: The chat route (`src/routes/issue.$issueKey.chat.tsx:161`) dispatches `document.dispatchEvent(new CustomEvent('aegis:stop-streaming'))`, but no component ever listens for this event. The ChatView component (`src/components/chat/ChatView.tsx:216-218`) exposes `handleStop` which calls `abortRef.current?.abort()`, and this is wired to the Stop button in MessageInput's `onStop` prop. However, the keyboard shortcut's custom event goes unheard.
- **Impact**: All chat users. The Escape-to-stop-streaming keyboard shortcut is completely non-functional. The only way to stop streaming is by clicking the stop button, which is a significant UX gap during long LLM responses.

### C2: Token refresh is not implemented -- all providers will silently fail after expiration

- **Journey step**: User has been working in the app for over an hour (Atlassian tokens expire after ~1hr, Google tokens similarly). They drag a card on the board or open a file in the IDE.
- **Expected**: The app should detect the expired token, refresh it using the refresh token, and retry the request transparently
- **Actual**: `AuthManager.refreshToken()` at `src/lib/auth/manager.ts:129-139` is a stub that unconditionally throws: `"Token refresh for "${provider}" not yet implemented. Re-initiate OAuth flow."`. When `requireAuth()` detects an expired token at line 62-66, it calls `refreshToken()` which throws. The user gets an opaque error with no guidance on how to re-authenticate.
- **Impact**: All authenticated users. After token expiration (1hr for Atlassian, 8hr for GitHub, varies for Google), every API call fails. The Service Worker at `public/sw.js:154-166` will continue injecting the stale token since it has no expiry awareness -- it just stores whatever token metadata it receives. The user must manually navigate to Settings and re-authenticate.

### C3: Service Worker injects expired tokens without checking expiry

- **Journey step**: User's Atlassian token expires after 1 hour. The SW still has the expired token in its `tokens` Map and injects it into every Jira API request.
- **Expected**: The SW should check token expiry before injection, or the main thread should proactively clear/refresh expired tokens
- **Actual**: The SW `handleApiRequest()` at `public/sw.js:154-166` only checks `if (!token)` -- it never checks `token.expiresAt`. The `AuthManager` stores metadata with `expiresAt` in localStorage (`src/lib/auth/manager.ts:281-297`) and sends the full TokenSet to the SW (`src/lib/auth/manager.ts:154-163`), but the SW ignores the expiry field entirely.
- **Impact**: All authenticated users after token expiry. Requests will fail with 401s from Jira/GitHub APIs, and the resilientFetch wrapper will NOT retry 401s (only 429, 500, 502, 503, 504 are in the retry set at `src/lib/fetch/resilient-fetch.ts:29`). The user sees a raw "Jira API error: 401 Unauthorized" with no actionable guidance.

### C4: Custom LLM provider references undefined `this.endpoint` in error message

- **Journey step**: User configures a custom LLM endpoint (e.g., self-hosted vLLM) and that endpoint is unreachable
- **Expected**: Error message should tell the user which endpoint failed
- **Actual**: `src/lib/llm/providers/custom.ts:137` references `this.endpoint` which does not exist as a class property. The class only has `private relayUrl: string` (line 83). The error message will read: `"Cannot connect to undefined. Check the URL and try again."` Since TypeScript's `private` is compile-time only, this won't throw at runtime but will produce a useless error message.
- **Impact**: All users of custom LLM endpoints when the endpoint is unreachable. The error message provides no actionable information.

### C5: Vertex AI and Ollama providers do not pass AbortSignal to fetch

- **Journey step**: User starts a chat with Vertex AI or Ollama provider, then clicks Stop or navigates away
- **Expected**: The HTTP request should be aborted, stopping the stream and freeing resources
- **Actual**: Only Anthropic (`src/lib/llm/providers/anthropic.ts:128`) and OpenAI (`src/lib/llm/providers/openai.ts:126`) pass `signal: params.signal` to `fetch()`. Vertex AI (`src/lib/llm/providers/vertex.ts:140-147`) and Ollama (`src/lib/llm/providers/ollama.ts:100-105`) do not pass the signal. The Custom provider (`src/lib/llm/providers/custom.ts:128-132`) also omits it.
- **Impact**: Users of Vertex AI, Ollama, and Custom providers. Clicking Stop will break out of the `for await` loop in ChatView, but the underlying HTTP connection stays open. The browser continues receiving data that is discarded. For Ollama (local), this wastes GPU resources. For Vertex AI, this continues consuming API quota. The ReadableStream reader in `stream-parser.ts:25-55` will only release its lock when the stream naturally completes.

### C6: Chat streaming does not abort on component unmount -- zombie async loop

- **Journey step**: User starts a chat with an LLM, then navigates away (e.g., clicks a board link) while the response is still streaming.
- **Expected**: The streaming loop is aborted and cleaned up when the ChatView component unmounts.
- **Actual**: The `handleSend` callback (`ChatView.tsx:100-213`) creates an AbortController stored in `abortRef`, but there is no `useEffect` cleanup that calls `abortRef.current?.abort()` on unmount. The streaming `for await` loop continues running after unmount, calling `appendStreamChunk` and `setStreaming` on a potentially stale session. The `useChatStore.getState()` calls inside the loop will succeed (Zustand is global), but this is wasted work and could cause confusing state mutations.
- **Impact**: Navigating away during streaming leaks the HTTP connection and continues processing chunks. Multiple zombie streams could accumulate if the user rapidly navigates between chat views.

## UX Issues (confusing or frustrating)

### U1: Auth-expired error on board shows raw API error, not re-auth prompt

- **Journey step**: User's Atlassian token expires. Board auto-refreshes (refetchOnWindowFocus is true at `src/lib/jira/queries.ts:103`). The request fails with 401.
- **Expected**: The board should detect the auth expiry and show the "Connect to Jira" empty state (the one at `src/components/board/BoardView.tsx:310-324`)
- **Actual**: The 401 response is not in the retry set, so `resilientFetch` returns it immediately. `JiraClient.request()` at `src/lib/jira/client.ts:63-70` throws a `JiraClientError` with status 401. This propagates to TanStack Query as `issuesError`. BoardView at line 307 checks `authManager.isConnected('atlassian')` -- but `isConnected()` at `src/lib/auth/manager.ts:77-80` checks the in-memory token metadata which was restored from localStorage on page load. The metadata may still show the token as "connected" (if the localStorage metadata hasn't been cleaned up), so the user sees the raw error message instead of the re-auth prompt.
- **Impact**: All Jira-authenticated users after token expiry. The user sees "Failed to load board: Jira API error: 401 Unauthorized" instead of the helpful "Connect to Jira" empty state with an action button.

### U2: Double-caching in Jira queries creates stale data that ignores cache invalidation

- **Journey step**: User drags a card to transition an issue. The mutation succeeds. The mutation's `onSuccess` at `src/lib/jira/queries.ts:232-248` invalidates both the IndexedDB cache and TanStack Query cache. But the next `queryFn` fires, finds the IndexedDB entry not yet expired (60s TTL), and returns stale data.
- **Expected**: After invalidation, fresh data should be fetched from the API
- **Actual**: The query function in `useIssues` at `src/lib/jira/queries.ts:93-95` first checks IndexedDB cache. `cache.invalidateBoardIssues(boardId)` at `src/lib/jira/cache.ts:187-191` only deletes the default-JQL key (`jira:board-issues:{boardId}:default`). If the user has active filters, the filtered cache entry (`jira:board-issues:{boardId}:{jqlString}`) is NOT deleted. The comment at cache.ts line 190 says "Additional JQL-filtered entries will expire via TTL" -- but with a 60s TTL and TanStack Query refetch happening immediately, the stale filtered data will be served.
- **Impact**: Users who have board filters active when performing transitions. The board may show the card in its old column until the 60-second IndexedDB TTL expires, even though TanStack Query invalidation fired correctly.

### U3: ErrorBoundary retry does not re-fetch data or reset route state

- **Journey step**: A React rendering error occurs in a route component (e.g., malformed Jira issue data causes a crash in BoardView). The ErrorBoundary at `src/components/shared/ErrorBoundary.tsx` catches it and shows "Something went wrong" with a "Try again" button.
- **Expected**: Clicking "Try again" should re-fetch data and re-render the route
- **Actual**: `handleRetry()` at `ErrorBoundary.tsx:28-30` simply resets the error state (`{ hasError: false, error: null }`). This re-renders the children, which will re-mount with stale TanStack Query cache data (since no invalidation occurs) and likely crash again with the same malformed data. There is no mechanism to clear the query cache, force a refetch, or navigate to a safe route.
- **Impact**: All users when a rendering error occurs. The "Try again" button creates an infinite crash loop if the error was caused by malformed data in the TanStack Query cache.

### U4: Chat streaming loop does not handle mid-stream network drops gracefully

- **Journey step**: User sends a message, AI starts streaming, then the network drops mid-response
- **Expected**: The error should be surfaced clearly, and the partial response should be preserved with a clear indication that it was truncated
- **Actual**: In `ChatView.tsx:150`, the `for await (const chunk of stream)` loop will throw when the ReadableStream reader encounters a network error in `stream-parser.ts:35` (`reader.read()` rejects). The catch block at `ChatView.tsx:193-198` appends `"\n\n**Error:** {message}"` to the assistant's content via `appendStreamChunk`. This results in the error appearing as part of the message text, rendered as markdown. The partial response is preserved, which is good, but the error text is embedded in the message content rather than shown as a distinct UI element (e.g., a toast or error banner).
- **Impact**: All chat users on unreliable networks. The error message looks like part of the AI's response, potentially confusing users.

### U5: Concurrent chat sends are not prevented during tool execution

- **Journey step**: During streaming, a tool call is being executed (`routeToolCall` at `ChatView.tsx:162-178`). The `isStreaming` flag is true, which disables the Send button in MessageInput. However, if the tool call takes a long time, the user might try to send another message by rapidly clicking or using Enter.
- **Expected**: Messages should be queued or the second send should be blocked
- **Actual**: The `handleSend` callback at `ChatView.tsx:101` checks `if (!session) return` but does not re-check `session.isStreaming`. The check relies on the `isStreaming` guard in `MessageInput.handleSend()` at line 35, which correctly prevents sends while streaming. However, there is a TOCTOU gap: if a user manages to call `handleSend` twice in rapid succession before the first call sets `isStreaming(issueKey, true)` at line 135, both calls would proceed, creating duplicate assistant messages and potentially corrupting the message history.
- **Impact**: Users who double-click the send button or press Enter very rapidly. Two assistant placeholder messages would be created, and two streaming loops would run concurrently for the same session, interleaving chunks from two separate API calls.

### U6: Board optimistic update leaks if transition modal is dismissed via browser navigation

- **Journey step**: User drags a card, the transition requires fields (hasScreen=true), the TransitionModal opens. User presses browser Back button instead of clicking Cancel.
- **Expected**: The optimistic update should be rolled back
- **Actual**: The TransitionModal cancel handler (`handleTransitionCancel` at `BoardView.tsx:241-247`) calls `rollbackOptimisticUpdate`. But if the user navigates away via browser back/forward, the component unmounts without triggering this callback. The `pendingTransition` and `optimisticUpdates` state live in Zustand (boardStore), which persists across route changes. The card will appear stuck in the wrong column until the user returns to the board and the TanStack Query refetch corrects it.
- **Impact**: Users who navigate away during a fields-required transition. The card appears in the wrong column with no indication that the transition was not completed.

### U7: Optimistic update not rolled back on TransitionModal submit failure

- **Journey step**: User drags a card to a column that requires fields (hasScreen: true). The TransitionModal opens. User fills in fields and clicks submit, but the Jira API returns an error.
- **Expected**: The optimistic update is rolled back and the card returns to its original column.
- **Actual**: `handleTransitionSubmit` (`BoardView.tsx:218-239`) calls `rollbackOptimisticUpdate` only on success. The error handling is in `TransitionModal.tsx:106-109`, which sets a local error state but does NOT roll back the optimistic update. The card stays in the wrong column until the user cancels the modal or the page refreshes.
- **Impact**: The board shows incorrect card positions after a failed transition-with-fields until the user explicitly cancels.

### U8: Board drag-and-drop does not prevent concurrent drags on the same card

- **Journey step**: User drags card A to column B. While the transition API call is in flight, user drags card A again to column C.
- **Expected**: The second drag is rejected or queued until the first completes.
- **Actual**: A second optimistic update overwrites the first (`applyOptimisticUpdate` at `board.ts:117-121` uses `Map.set`, which replaces). If the first transition succeeds and calls `rollbackOptimisticUpdate`, it removes the entry -- but the second transition is now in flight with stale data. Both `rollbackOptimisticUpdate` calls reference the same issueKey, creating a race condition where the card may end up in an inconsistent visual state.
- **Impact**: Rapid dragging of the same card can cause visual glitches and potentially conflicting API calls.

## Polish Items (works but could be better)

### P1: Resilient fetch GET deduplication does not account for different request headers

- **Suggestion**: The `inflightGETs` map at `src/lib/fetch/resilient-fetch.ts:36` keys by URL alone. Two GET requests to the same URL but with different headers (e.g., different `Accept` values) will be incorrectly deduplicated, with the second caller receiving a clone of the first request's response. In the current codebase this is unlikely to cause issues since the Jira and GitHub clients use consistent headers, but it could be a footgun if the pattern is extended. Consider including a hash of relevant headers in the dedup key.

### P2: TanStack Query does not have a global error handler

- **Suggestion**: The QueryClient at `src/main.tsx:8-15` uses default error handling (errors surface per-query). There is no `onError` callback or error boundary integration at the QueryClient level. Consider adding a global `onError` handler that shows a toast for unexpected errors, or configure `throwOnError` for use with the ErrorBoundary.

### P3: IndexedDB expired entries are never proactively evicted

- **Suggestion**: `CacheStore.evictExpired()` exists at `src/lib/cache/indexeddb.ts:218-246` but is never called anywhere in the codebase. Expired entries are passively ignored on read (returning null) but accumulate in IndexedDB indefinitely. For users who use the app daily, this could lead to significant storage bloat over weeks. Consider running `evictExpired()` on app startup or on a periodic timer (e.g., every hour).

### P4: SW LLM relay does not handle fetch failures

- **Suggestion**: `handleLLMRelay` at `public/sw.js:179-242` calls `fetch(relayedRequest)` without a try/catch. If the target LLM endpoint is unreachable, the SW's fetch handler will reject with an unhandled error, causing the browser to show a generic network error. The other API handlers (`handleApiRequest`, `cacheFirst`, `networkFirst`) also lack error handling for the relay case. Consider wrapping the fetch in a try/catch and returning a structured JSON error response.

### P5: Chat session persistence fires on every message add, not debounced

- **Suggestion**: `addMessage` at `src/stores/chat.ts:113-115` calls `persistSession` after every message. During active streaming, `appendStreamChunk` does not trigger persistence (good), but each individual message add (user message, assistant placeholder) triggers a full IndexedDB write. For conversations with many messages, this serializes the entire message array to IndexedDB on every send. Consider debouncing persistence or only persisting when streaming ends.

### P6: VFS commit does not guard against concurrent commit operations

- **Suggestion**: `VirtualFileSystem.commit()` at `src/lib/vfs/virtual-fs.ts:310-344` has no concurrency guard. If a user double-clicks the Commit button before `isCommitting` state updates (TOCTOU gap similar to U5), two concurrent commit operations could run against the same `headCommitSha`. The second commit's `updateRef` would either fail (if the ref was already advanced) or succeed with a force-update losing the first commit. The SourceControl component does disable the button via `isBusy` state (`src/components/ide/SourceControl.tsx:110`), but the gap between click and setState is a race window.

### P7: Monaco editor model disposal may leak if path changes while component is mounted

- **Suggestion**: The Monaco cleanup effect at `src/components/ide/MonacoEditor.tsx:109-120` uses `modelUri` in its dependency array. If the `path` prop changes (e.g., user switches tabs), the cleanup runs and disposes the model. However, `editorRef.current` is set in `handleMount` which runs asynchronously. If the component re-renders with a new path before the old editor has mounted, `editorRef.current` may be null in the cleanup, leaving the old model un-disposed.

### P8: Toast notifications do not cap maximum visible count

- **Suggestion**: `useToastStore.addToast` (`stores/toast.ts:47-65`) appends without limit. If 20 API calls fail simultaneously, 20 error toasts stack up. Consider capping at 5 visible toasts, dismissing the oldest when the limit is exceeded.

### P9: Anthropic and OpenAI provider constructors accept but ignore config parameters

- **Suggestion**: Both constructors accept `config: { apiKey?: string; baseUrl?: string }` but never use either parameter. `this.relayUrl` is hardcoded to the SW relay path. Either use the config values or remove the parameters to avoid developer confusion.

### P10: IDE PR creation uses duplicated issue key as title

- **Suggestion**: `IDELayout.tsx:112` creates the PR with `title: '${issueKey}: ${issueKey}'` -- the issue key is duplicated (e.g., "PROJ-123: PROJ-123"). Should use the issue summary as the second part.

### P11: Chat message IDs use `Date.now()` -- potential collision risk

- **Suggestion**: `ChatView.tsx:109,117` uses `'user-${Date.now()}'` and `'asst-${Date.now()}'` for message IDs. While different prefixes prevent same-role collision, rapid sends within the same millisecond could still produce identical IDs. Consider using `crypto.randomUUID()`.

### P12: `CacheStore.getDb()` does not handle IndexedDB blocked events

- **Suggestion**: `CacheStore.getDb()` (`cache/indexeddb.ts:37-55`) does not listen for the `blocked` event on the `IDBOpenDBRequest`. If another tab has an older version of the database open, the promise will hang indefinitely. Add an `onblocked` handler with a timeout and user notification.

### P13: SW MessageChannel port leak on timeout

- **Suggestion**: When the `postMessageToSW` timeout fires (`sw-bridge.ts:80-82`), `channel.port1.onmessage` is never removed. If the SW responds late, the handler fires on an already-rejected promise. Set `channel.port1.onmessage = null` in the timeout handler.

## Positive Observations

- **Resilient fetch is well-designed**: The exponential backoff with jitter, Retry-After header parsing, GET deduplication, and AbortSignal integration in `src/lib/fetch/resilient-fetch.ts` are solid. The `wait()` helper properly cleans up event listeners.
- **PKCE implementation is correct**: The OAuth flows in `src/lib/auth/pkce.ts` properly generate code verifiers, challenges with S256, and random state parameters using the Web Crypto API. Session storage cleanup after callback handling is thorough.
- **Token security model is sound**: Actual tokens live only in SW memory (not page JS). Metadata in localStorage is non-sensitive. The `postMessage` bridge with `MessageChannel` for request/response semantics is a good pattern.
- **Optimistic update with rollback in BoardView is robust**: The drag-and-drop transition flow at `src/components/board/BoardView.tsx:126-212` correctly applies optimistic updates, handles the case where no matching transition exists, supports field-required transitions via modal, and rolls back on any failure. Toast notifications provide good feedback.
- **IDE cancellation pattern is correct**: The `cancelled` flag in `IDELayout.tsx:84-99` properly prevents state updates after the component unmounts during async file loading.
- **Content-addressed blob caching is clever**: The VFS cache at `src/lib/vfs/cache.ts` keying on blob SHA means cache entries never go stale by design, which is a strong architectural choice.
- **Shortcut registry with chord support is clean**: The two-phase chord handling in `src/lib/shortcuts/registry.ts` with timeout cleanup, editable-element suppression, and conditional `when` guards is well-structured and properly prevents shortcut interference with text input.
- **Stream parsers handle malformed data gracefully**: Both `parseAnthropicStream` and `parseOpenAIStream` in `src/lib/llm/stream-parser.ts` silently skip malformed JSON lines and handle partial chunks correctly. The `readSSELines` helper properly manages buffer splitting across reads.
- **Monaco editor cleanup is correct**: The `useEffect` cleanup in `MonacoEditor.tsx:109-120` properly disposes the model on unmount, preventing memory leaks from accumulated Monaco models.
- **Toast store properly cleans up timers**: Both `removeToast` and `clearToasts` cancel pending timeouts via `clearTimeout`, preventing zombie timer callbacks.
