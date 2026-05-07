# Proposal: Pass AbortSignal to All LLM Providers

## Type: fix
## Source: UAT-4 C5
## Problem: Only Anthropic and OpenAI providers pass the AbortSignal to `fetch()`. Vertex AI, Ollama, and Custom providers ignore it, so clicking Stop leaves HTTP connections open, wasting resources and API quota.
## Solution:
Add `signal: params.signal` to the fetch call in each provider:

1. `src/lib/llm/providers/vertex.ts` — add `signal: params.signal` to fetch options
2. `src/lib/llm/providers/ollama.ts` — add `signal: params.signal` to fetch options  
3. `src/lib/llm/providers/custom.ts` — add `signal: params.signal` to fetch options

Also fix the `this.endpoint` → `this.relayUrl` reference in custom.ts error message (UAT-4 C4).

## Effort: S
## Files affected:
- `src/lib/llm/providers/vertex.ts`
- `src/lib/llm/providers/ollama.ts`
- `src/lib/llm/providers/custom.ts`
## Test plan:
- Start streaming with each provider
- Click Stop → verify no network requests remain in-flight (Network tab)
- Verify custom provider error message shows the correct URL
