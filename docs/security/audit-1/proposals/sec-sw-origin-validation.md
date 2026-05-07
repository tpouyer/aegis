# Proposal: Validate Message Origin in Service Worker
## Severity: Medium (P2)
## Finding: F7
## Problem: SW message handler processes SET_TOKEN/CLEAR_TOKEN from any sender without origin validation. A same-origin iframe or related subdomain could inject tokens.
## Solution:
Add origin validation to the SW message handler:

```js
self.addEventListener('message', (event) => {
  if (event.origin && event.origin !== self.location.origin) {
    return; // Ignore cross-origin messages
  }
  // ... existing handler
});
```
## Effort: S
## Files: `public/sw.js`
## Test: Send postMessage from a cross-origin iframe → message is ignored.
