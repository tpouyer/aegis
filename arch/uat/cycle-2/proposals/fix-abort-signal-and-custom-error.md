# Proposal: Pass AbortSignal to all LLM providers and fix custom provider error message

## Type: fix

## Source: UAT-4 (Error Paths) C4, C5

## Problem
Two related LLM provider issues: (1) Vertex AI, Ollama, and Custom providers do not pass `AbortSignal` to `fetch()`, so clicking Stop or navigating away leaves HTTP connections open, wasting GPU/API resources. (2) The Custom provider references `this.endpoint` (undefined) in its error message instead of `this.relayUrl`, producing "Cannot connect to undefined".

## Solution

1. **Add `signal` to fetch calls**:
   - `src/lib/llm/providers/vertex.ts:140-147`: Add `signal: params.signal` to the `fetch()` options
   - `src/lib/llm/providers/ollama.ts:100-105`: Add `signal: params.signal` to the `fetch()` options
   - `src/lib/llm/providers/custom.ts:128-132`: Add `signal: params.signal` to the `fetch()` options
   - Follow the same pattern used in `anthropic.ts:128` and `openai.ts:126`

2. **Fix error message in custom provider**:
   - `src/lib/llm/providers/custom.ts:137`: Change `this.endpoint` to `this.relayUrl` so the error message reads "Cannot connect to https://my-endpoint.example.com" instead of "Cannot connect to undefined"

## Effort: S

## Files affected
- `packages/app/src/lib/llm/providers/vertex.ts` (add signal to fetch)
- `packages/app/src/lib/llm/providers/ollama.ts` (add signal to fetch)
- `packages/app/src/lib/llm/providers/custom.ts` (add signal to fetch, fix error message)

## Test plan
- Unit test: Vertex provider's `chat()` passes `signal` to fetch mock
- Unit test: Ollama provider's `chat()` passes `signal` to fetch mock
- Unit test: Custom provider's `chat()` passes `signal` to fetch mock
- Unit test: Custom provider error message includes the actual relay URL, not "undefined"
- Manual test: start chat with Ollama, click Stop -- verify the HTTP request is actually cancelled (check Network tab)
- Manual test: configure an unreachable custom endpoint, send a message -- verify error says "Cannot connect to https://..."
