# Proposal: Progressive Auth Nudges with Onboarding Wizard

## Type: enhancement
## Source: UAT-1 U5, UAT-1 C1, UAT-1 C2, Cycle-1 approved: growth-progressive-auth-nudges
## Problem: The OnboardingWizard component is fully built but never rendered. Auth connect buttons on landing and settings pages are non-functional (console.info only). Users have no way to authenticate.
## Solution:
1. **Show OnboardingWizard on first visit**: Check localStorage for `aegis_onboarded` flag. If absent, show the wizard.
2. **Wire auth connect buttons**: Import and call the actual OAuth initiation functions from `src/lib/auth/`:
   - Landing page: `initiateGitHubAuth()` for "Connect GitHub"
   - Settings: Wire each provider's `initiate*Auth()` function
3. **Add OAuth callback route**: Create `src/routes/auth.callback.tsx` that:
   - Reads `code` and `state` from URL params
   - Calls the appropriate `handle*Callback()` function
   - Stores the token via `authManager.setToken()`
   - Redirects back to the original page
4. **Progressive nudges**: When a user hits a feature requiring auth, show a contextual nudge (not just the error state)

## Effort: L
## Files affected:
- `src/routes/index.tsx`
- `src/routes/settings.tsx`
- `src/routes/auth.callback.tsx` (new)
- `src/routes/__root.tsx`
- `src/components/shared/OnboardingWizard.tsx`
## Test plan:
- First visit → OnboardingWizard appears
- Click "Connect GitHub" → OAuth flow initiates
- After callback → token stored, user level updated
- Settings page Connect buttons work for all 4 providers
