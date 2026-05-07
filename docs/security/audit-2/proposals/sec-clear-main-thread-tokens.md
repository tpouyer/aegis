# Proposal: Clear Access Tokens from Main Thread After SW Sync
## Severity: Medium
## Finding: R2-F3
## Solution: After calling `sendTokenToSW()`, replace the accessToken in `this.state.tokens[provider]` with an empty string. Keep metadata (expiry, provider) for UI rendering but remove the secret.
## Effort: S
## Files: `src/lib/auth/manager.ts`
