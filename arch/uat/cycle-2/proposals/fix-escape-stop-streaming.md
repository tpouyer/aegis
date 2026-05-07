# Proposal: Wire Escape Key to Stop Streaming

## Type: fix
## Source: UAT-2 C1, UAT-4 C1
## Problem: The Escape keyboard shortcut dispatches `aegis:stop-streaming` custom event but no component listens for it, making the shortcut completely non-functional.
## Solution:
Add event listener in `ChatView` component to handle the `aegis:stop-streaming` event:

```tsx
// In ChatView, add useEffect:
useEffect(() => {
  const handleStopStreaming = () => {
    abortRef.current?.abort()
  }
  document.addEventListener('aegis:stop-streaming', handleStopStreaming)
  return () => document.removeEventListener('aegis:stop-streaming', handleStopStreaming)
}, [])
```

## Effort: S
## Files affected:
- `src/components/chat/ChatView.tsx`
## Test plan:
- Open chat, send a message, press Escape during streaming → streaming stops
- Verify stop button still works via click
- Verify Escape doesn't interfere when not streaming
