# Proposal: Run IndexedDB Cache Eviction on Startup
## Severity: Low
## Finding: R2-F5
## Solution: Call `evictExpired()` on the chat and Jira cache stores during app initialization in main.tsx.
## Effort: S
## Files: `src/main.tsx`, `src/lib/cache/indexeddb.ts`
