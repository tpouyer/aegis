# Proposal: Restrict Custom LLM Relay to Configured Endpoint
## Severity: Critical (P0)
## Finding: F1 (T4)
## Problem: The SW custom LLM relay accepts arbitrary URLs from the request path, allowing any code to exfiltrate the API key to an attacker-controlled endpoint.
## Solution:
1. Store the configured custom endpoint URL in the SW's token map alongside the API key
2. In `handleLLMRelay()`, validate that the decoded URL starts with the stored endpoint base URL
3. Reject requests to any other URL with a 403

```js
case 'custom': {
  const storedConfig = tokens.get('custom');
  const decoded = decodeURIComponent(remainingPath);
  if (!storedConfig?.endpoint || !decoded.startsWith(storedConfig.endpoint)) {
    return new Response(JSON.stringify({ error: 'Relay URL does not match configured endpoint' }), { status: 403 });
  }
  targetUrl = decoded;
  authProvider = 'custom';
  break;
}
```
## Effort: S
## Files: `public/sw.js`, `src/components/chat/ProviderPicker.tsx` (store endpoint in token)
## Test: Attempt relay to non-configured URL → 403. Relay to configured URL → works.
