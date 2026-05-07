# Proposal: Fix LLM Provider Switch Mid-Session

## Type: fix
## Source: UAT-2 C3
## Problem: Changing LLM provider after a session exists silently fails because `createSession()` has an early return when a session already exists, and the existing `switchProvider` action is never called from the UI.
## Solution:
In `ChatView.handleProviderSelected`, call `switchProvider` instead of `createSession` when a session already exists:

```tsx
const handleProviderSelected = useCallback(
  (providerId: string) => {
    const provider = providerRegistry.getProvider(providerId)
    if (!provider) return
    const defaultModel = provider.models[0]?.id ?? ''
    
    if (sessions.has(issueKey)) {
      switchProvider(issueKey, providerId)
      switchModel(issueKey, defaultModel)
    } else {
      createSession(issueKey, providerId, defaultModel)
    }
  },
  [issueKey, sessions, createSession, switchProvider, switchModel],
)
```

## Effort: S
## Files affected:
- `src/components/chat/ChatView.tsx`
## Test plan:
- Open chat, select Anthropic provider, send a message
- Click "Change provider...", select OpenAI
- Verify session now uses OpenAI provider
- Verify existing messages are preserved
