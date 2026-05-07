# ADR-003: WASM Engine Boundaries

## Status: Accepted

## Context

Aegis runs entirely in the browser with no backend infrastructure. The WASM engine (compiled from Rust via wasm-pack) is the core computational component that handles organizational context resolution, content visibility, and MCP protocol handling. We need clear boundaries between what runs inside WASM linear memory and what stays in JavaScript/Service Worker land.

Key forces at play:

- **Performance**: hierarchy resolution and content filtering must be fast and synchronous. Crossing the WASM-JS boundary has overhead, so the engine should do complete units of work per call.
- **Security**: content visibility must be enforced deterministically. Auth filtering in WASM is not bypassable by client-side JavaScript.
- **Capability constraints**: WASM has no access to DOM, network, or persistent storage. These capabilities must remain in JavaScript.
- **Code reuse**: the hierarchy resolution and config parsing logic originates from sdlc-mcp (Rust); the tool catalog and sandbox originate from cmcp (Rust). Keeping them in Rust avoids a rewrite.

## Decision

### What runs in WASM

| Module | Responsibility |
|---|---|
| `hierarchy` | Scope filtering by repo and auth level; "most specific wins" merge logic; content resolution ordering |
| `config` | YAML parsing of scope definitions and component-to-repo mappings; validation of configuration structure |
| `auth_filter` | Content visibility filtering by auth level (Public < GitHub < RedHatSSO); returns a filtered manifest |
| `catalog` | Tool catalog management; case-insensitive search over tool names and descriptions; exact name lookup |
| `mcp` | MCP protocol handler for `tools/list` and `tools/call`; content tool resolution; routing indicators for upstream tools |
| `sandbox` | (Future) QuickJS sandbox for safe execution of TypeScript code from MCP tool aggregation `search()` and `execute()` calls |

The `ProxyEngine` struct is the single wasm-bindgen entry point. It holds the parsed manifest and tool catalog in WASM linear memory. All methods accept and return JSON strings, keeping the JS-WASM interface simple.

### What stays in JavaScript

| Capability | Reason |
|---|---|
| Network requests (fetch to Jira, GitHub, LLM providers) | WASM has no network access |
| DOM manipulation (React rendering) | WASM has no DOM access |
| IndexedDB (caching, chat history, offline data) | WASM has no storage APIs |
| Auth token management (OAuth flows, token refresh, secure storage) | Requires browser APIs (crypto, storage, redirects) |
| Service Worker lifecycle (caching, request interception) | Browser API exclusive |
| Monaco editor integration | DOM-dependent |
| Streaming LLM responses (ReadableStream, SSE parsing) | Requires fetch streaming |

### Module responsibilities and boundaries

```
JavaScript (Service Worker / React App)
  │
  │  1. Load manifest JSON from static host
  │  2. Instantiate ProxyEngine(manifest_json)
  │  3. Call engine methods with JSON strings
  │
  ├── resolve_content(repo, auth_level) ──────────► WASM: hierarchy + auth_filter
  │     ◄── JSON array of ResolvedContent
  │
  ├── filter_manifest(auth_level) ────────────────► WASM: auth_filter
  │     ◄── JSON manifest (filtered)
  │
  ├── tools_list(auth_level) ─────────────────────► WASM: mcp + auth_filter + catalog
  │     ◄── JSON { tools: [...] }
  │
  ├── tools_call(tool_name, args, auth_level) ────► WASM: mcp
  │     ◄── JSON result OR { route_to_upstream: true }
  │         │
  │         └── If route_to_upstream: JS handles network call to upstream MCP
  │
  └── query_tools(search) ───────────────────────► WASM: catalog
        ◄── JSON array of matching tools
```

### QuickJS sandbox purpose

The sandbox module (currently a placeholder) will embed QuickJS compiled to WASM-within-WASM. Its purpose is safe execution of TypeScript code that powers the `search()` and `execute()` MCP tools from the cmcp tool aggregation pattern:

- `search(code)`: user-provided TypeScript that queries upstream tool catalogs. The sandbox executes this code with access to a restricted API surface (tool catalog queries only, no network, no filesystem).
- `execute(code)`: user-provided TypeScript that invokes upstream tools. The sandbox executes the code, collects tool call requests, and returns them to the JavaScript layer for actual network execution.

The sandbox provides isolation: untrusted code from tool definitions cannot access WASM engine internals, browser APIs, or user data. TypeScript is transpiled to JavaScript via oxc (also compiled to WASM) before sandbox execution.

### Performance characteristics

- **Manifest loaded once**: the JSON manifest is parsed into Rust structs on `ProxyEngine::new()`. All subsequent calls operate on in-memory data.
- **All resolution is synchronous**: no async, no promises, no callbacks. The JS caller gets an immediate return value.
- **No serialization overhead for internal operations**: hierarchy resolution, auth filtering, and catalog queries all operate on native Rust structs. JSON serialization only happens at the WASM-JS boundary.
- **Expected latency**: content resolution for a typical manifest (50 scopes, 200 content items, 100 tools) completes in under 1ms.

## Consequences

**What becomes easier:**
- Content resolution is deterministic and testable in pure Rust (no browser needed for unit tests)
- Auth filtering cannot be bypassed by client-side code modification
- The same WASM binary works in browsers, Cloudflare Workers, Deno, and Node.js
- Manifest is immutable after load, eliminating race conditions

**What becomes harder:**
- Debugging requires source maps and wasm-pack tooling
- Adding new engine features requires Rust knowledge and a rebuild
- The JSON serialization boundary means every call has encode/decode overhead
- WASM binary adds ~1-2MB to the initial download (mitigated by Service Worker caching)

## Alternatives Considered

**Pure JavaScript engine**: Would eliminate the WASM-JS boundary overhead and simplify the build pipeline. Rejected because the hierarchy resolution and config parsing code already exists in Rust (from sdlc-mcp and cmcp), and the QuickJS sandbox requires WASM regardless. Rewriting in JavaScript would lose the type safety and performance benefits.

**Rust with direct DOM bindings (web-sys)**: Would allow the engine to render UI directly. Rejected because React is the chosen UI framework, and mixing Rust-rendered DOM with React creates complexity without benefit. The engine should be a pure computation layer.

**Separate WASM modules per concern**: Each module (hierarchy, catalog, sandbox) as its own WASM binary. Rejected because the modules share types and the manifest data structure. A single binary with shared memory is simpler and avoids cross-module coordination overhead.
