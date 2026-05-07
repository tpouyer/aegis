# Wave 1 Adversarial Review

## Summary
The Wave 1 foundation is well-structured with strong security design principles and comprehensive test coverage. 3 blockers were identified and fixed. 5 warnings remain as non-blocking issues for future resolution.

## Blockers (FIXED)

### B1: OAuth callback handlers missing config parameter — FIXED
- **Files**: github.ts, atlassian.ts, google.ts
- **Issue**: Token exchange read `client_id` and `redirect_uri` from callback URL params, but OAuth providers don't echo these back. Would cause 400 errors.
- **Fix**: Added `config` parameter to all `handle*Callback` functions, using `config.clientId` and `config.redirectUri`.

### B2: Hierarchy resolution non-deterministic for equal-priority scopes — FIXED
- **File**: packages/engine/src/hierarchy.rs:49
- **Issue**: Two repo-specific scopes with same priority had undefined winner (depended on iteration order).
- **Fix**: Added lexicographic tie-breaker on scope name. Updated test to assert deterministic result.

### B3: Token metadata restoration creates placeholder tokens — FIXED
- **File**: packages/app/src/lib/auth/manager.ts
- **Issue**: `restoreTokenMetadata()` created TokenSets with empty `accessToken`, passing validation in `isConnected()` and `requireAuth()`.
- **Fix**: Added `!!token.accessToken` check to both `isConnected()` and `requireAuth()`.

## Warnings (should fix in later waves)

### W1: Service Worker token Map not durable across SW termination
- Tokens in SW memory Map are lost when browser kills SW after ~30s inactivity.
- Needs: lazy token re-sync from main thread on SW restart.

### W2: GitHub token exchange will fail with CORS in production
- `github.ts:93` directly fetches GitHub's token endpoint which blocks CORS.
- Needs: CORS proxy routing through SW or Cloudflare Worker.

### W3: PKCE state not cleared on OAuth error paths
- If OAuth returns error, sessionStorage verifier/state are not cleaned up.
- Fix: move cleanup to `finally` block.

### W4: No CSP defined to prevent Service Worker replacement
- ADR-004 references CSP but none is configured in index.html.
- Needs: `worker-src 'self'` and `script-src 'self'` meta tag.

### W5: Auth level computation comment/code mismatch on expired tokens
- Comment says expired RH SSO with refresh token maintains SSO level; code doesn't do this.

## Notes

- N1: No `unwrap()` in Rust production code — all error paths use `Result` + `?`.
- N2: TypeScript strict mode enabled, no user-written `any` types.
- N3: Dependencies are current, no version conflicts.
- N4: Monaco lazy-loading boundary not yet verified (IDE route not implemented yet).
- N5: Good unit test coverage but no integration/E2E tests yet.
- N6: No rate limiting in Service Worker for Jira/GitHub APIs.
- N7: WASM engine correctly has no network/DOM dependencies.
