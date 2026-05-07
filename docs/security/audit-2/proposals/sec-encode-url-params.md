# Proposal: Encode URL Path Parameters in API Clients
## Severity: High
## Finding: R2-F2
## Solution: Apply `encodeURIComponent()` to all path parameters (issueKey, owner, repo, ref, sha, branchName) in Jira and GitHub client URL construction.
## Effort: S
## Files: `src/lib/jira/client.ts`, `src/lib/github/client.ts`
