# Proposal: Fix Debug Logging Guard for Production
## Severity: Medium
## Finding: R2-F4
## Solution: Replace `process.env.NODE_ENV` check with `import.meta.env.DEV` which is correctly stripped by Vite in production builds.
## Effort: S
## Files: `src/lib/llm/tool-router.ts`
