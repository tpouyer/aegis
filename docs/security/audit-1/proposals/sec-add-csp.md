# Proposal: Add Content Security Policy Meta Tag
## Severity: Medium (P2)
## Finding: F10
## Problem: No CSP is set, so any successful XSS can freely fetch to any domain and load external scripts.
## Solution:
Add a CSP meta tag to `packages/app/index.html`:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://api.github.com https://*.atlassian.net https://*.atlassian.com https://api.anthropic.com https://api.openai.com https://*.googleapis.com https://accounts.google.com https://auth.atlassian.com https://github.com;
  img-src 'self' https: data:;
  font-src 'self';
  frame-src 'none';
">
```
## Effort: S
## Files: `packages/app/index.html`
## Test: Attempt to load an external script → blocked by CSP. API calls to allowed domains → work normally.
