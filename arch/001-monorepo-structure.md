# ADR-001: Monorepo Structure

## Status: Accepted

## Context
Aegis consists of two tightly coupled deliverables: a Rust WASM engine and a React SPA that consumes it. We need a repository structure that supports independent development of each while maintaining a coherent build pipeline. The WASM engine must be compiled before the SPA can bundle it.

## Decision
Use an npm workspaces monorepo with two packages:

```
packages/
  app/     — React SPA (Vite, TypeScript)
  engine/  — Rust WASM module (wasm-pack)
```

Build order: engine → app. The engine compiles via `wasm-pack build --target web` and outputs directly into `packages/app/src/wasm/` so Vite can import it as a standard ES module.

Root `package.json` defines workspace scripts that orchestrate the full build (`build:engine` then `build:app`).

A `config/` directory at the root holds scope definitions (`scopes.yml`) and component-to-repo mappings (`components.yml`) consumed at build time.

## Consequences
- **Positive:** Single repo, single CI pipeline, atomic commits across engine + app changes.
- **Positive:** wasm-pack output landing in `src/wasm/` means Vite handles WASM as a regular import with no special loader config.
- **Negative:** Developers need both Rust and Node toolchains installed. Mitigated by CI doing the full build.
- **Negative:** Engine changes require a rebuild step before the SPA reflects them during development.

## Alternatives Considered
- **Separate repos:** Would require publishing the WASM package to npm or a private registry. Adds ceremony for tightly coupled changes. Rejected for velocity.
- **Turborepo/Nx:** Adds orchestration tooling overhead for only two packages. npm workspaces is sufficient.
- **Engine output to `public/`:** Would require dynamic WASM loading at runtime instead of static import. More complex initialization. Rejected.
