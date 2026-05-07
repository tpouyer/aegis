# Proposal: Sanitize API Error Messages
## Severity: High
## Finding: R2-F1
## Solution: Replace raw response bodies in error messages with sanitized versions. Show only status code and a generic message to the UI; log details to console in dev mode only.
## Effort: S
## Files: `src/lib/jira/client.ts`, `src/lib/github/client.ts`
