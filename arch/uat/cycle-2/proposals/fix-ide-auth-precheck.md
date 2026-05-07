# Proposal: Add GitHub auth pre-check to IDE route and fix PR title

## Type: fix

## Source: UAT-1 (New Contributor) C6; UAT-2 (Power User) U3; UAT-1 P4

## Problem
The IDE route immediately makes unauthenticated GitHub API calls with no pre-check, producing a cryptic "GitHub API 401: Unauthorized" error with no guidance. Additionally, the PR title template is `${issueKey}: ${issueKey}` which duplicates the issue key instead of including the summary. Both issues flagged across multiple UAT reports.

## Solution

1. **Auth pre-check (`src/routes/issue.$issueKey.ide.tsx`)**:
   - Before calling `fs.ensureBranch()` at line 97, check `authManager.isConnected('github')`
   - If not connected, skip the VFS initialization and set an error state that triggers the auth-required `EmptyState` variant
   - The existing error state at line 123-126 should be updated to show a "Connect GitHub" CTA button (using the `EmptyState` component with `variant="auth-required"`) instead of a raw error message with an AlertTriangle icon

2. **Fix PR title (`src/components/ide/IDELayout.tsx:112`)**:
   - Change `` `${issueKey}: ${issueKey}` `` to `` `${issueKey}: ${issueSummary || 'Update'}` ``
   - Pass the issue summary through to `IDELayout` from the route component (it can come from the issue context or be extracted from the VFS/Jira data)
   - Improve the PR body similarly: `` `Addresses ${issueKey}\n\n${issueSummary}` ``

3. **Auth-required empty state improvement (`src/components/ide/IDELayout.tsx:235`)**:
   - Change `window.location.href = '/settings'` to use TanStack Router's `useNavigate()` for client-side navigation (also fixes UAT-1 U4 for the IDE case)

## Effort: S

## Files affected
- `packages/app/src/routes/issue.$issueKey.ide.tsx` (auth pre-check before VFS init)
- `packages/app/src/components/ide/IDELayout.tsx` (fix PR title, fix navigation)

## Test plan
- Unit test: IDE route without GitHub auth shows auth-required empty state (not raw error)
- Unit test: PR title includes issue summary, not duplicated key
- Manual test: navigate to `/issue/PROJ-123/ide` without GitHub auth -- see "Connect GitHub" empty state
- Manual test: click "Connect GitHub" in IDE empty state -- client-side navigation to settings (no page reload)
- Manual test: create a PR in IDE -- verify title is "PROJ-123: Implement feature X" (not "PROJ-123: PROJ-123")
