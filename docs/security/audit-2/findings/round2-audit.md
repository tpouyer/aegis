# Security Audit Round 2 — Post-Fix Re-assessment

## Round 1 Fix Verification

| Fix | Status | Notes |
|-----|--------|-------|
| Custom relay URL restriction | ✅ Verified | sw.js now checks stored endpoint prefix |
| Vertex AI relay restriction | ✅ Verified | Regex validates *-aiplatform.googleapis.com |
| SafeLink XSS prevention | ✅ Verified | javascript: URIs render as plain text |
| Prompt injection boundaries | ✅ Verified | user_content tags in system-prompt.ts |
| SW message source validation | ✅ Verified | Rejects non-window sources |
| CSP meta tag | ✅ Verified | index.html has restrictive CSP |

## Remaining Findings from Round 1

### R2-F1: API error messages leak server internals (HIGH)
- **File**: `src/lib/jira/client.ts:72-74`, `src/lib/github/client.ts`
- **Issue**: Raw API response bodies are included in thrown errors which render in the UI
- **Fix**: Sanitize error messages before display — strip response bodies, show only status code + user-friendly message

### R2-F2: URL path parameters not encoded in API clients (HIGH)
- **File**: `src/lib/jira/client.ts` (issueKey in URLs), `src/lib/github/client.ts` (owner/repo/ref in URLs)
- **Issue**: Parameters interpolated into URL paths without encoding — enables path traversal
- **Fix**: Use `encodeURIComponent()` on all path parameters

### R2-F3: AuthManager stores tokens in main thread memory (MEDIUM)
- **File**: `src/lib/auth/manager.ts:108-109`
- **Issue**: `this.state.tokens[provider] = token` stores the full token in main-thread memory, contradicting the documented security model
- **Fix**: Only store the token metadata (expiry, provider) in main thread. Send actual tokens only to SW. Clear accessToken from state after sending to SW.

### R2-F4: Tool router debug logging in production (MEDIUM)
- **File**: `src/lib/llm/tool-router.ts:24-26`
- **Issue**: `DEBUG` defaults to `true` in browser — logs tool arguments in production
- **Fix**: Use `import.meta.env.DEV` instead of process.env check

### R2-F5: IndexedDB cache eviction never called (LOW)
- **File**: `src/lib/cache/indexeddb.ts`
- **Issue**: `evictExpired()` exists but is never invoked — expired entries accumulate
- **Fix**: Call `evictExpired()` on app startup or periodically
