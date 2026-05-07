# Proposal: Fix LLM Provider Token Type Safety
## Severity: Medium (P2)
## Finding: F4 (T8)
## Problem: ProviderPicker casts LLM provider IDs as `'github'` type when storing API keys in the SW, creating a type safety gap.
## Solution:
1. Change `sendTokenToSW` to accept `provider: string` instead of `AuthProvider`
2. Update the SW to accept any string as a token key (it already does at runtime)
3. Remove the `as 'github'` casts in ProviderPicker
## Effort: S
## Files: `src/lib/auth/sw-bridge.ts`, `src/components/chat/ProviderPicker.tsx`, `src/lib/auth/types.ts`
## Test: Store Anthropic API key → verify it's stored under 'anthropic', not 'github'. TypeScript compiles without casts.
