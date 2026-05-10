# ADR-002: TanStack Start as the framework

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--09-blue)

## Context

The framework call locks routing convention, SSR strategy, the call-the-server-from-the-client pattern, the build/deploy chain, and the surface area agents pattern-match on for "how do you do X" in this codebase. Picking it after the runtime ([ADR-001](001-cloudflare-workers-runtime.md)) keeps the runtime + framework boundary clean: Workers handles deploy and bindings, the framework handles routing and SSR.

## Decision

[TanStack Start](https://tanstack.com/start/latest) as the framework, with file-based routing via [TanStack Router](https://tanstack.com/router/latest), SSR + API routes in a single bundle, and Workers as the deploy target via the [Cloudflare Vite plugin](https://github.com/cloudflare/workers-sdk/tree/main/packages/vite-plugin). Server functions (`createServerFn`) collapse the call-server-from-client boundary into a typed import; HTTP API routes live alongside page routes in `src/routes/api/`.

## Consequences

**Positive:**

- TypeScript-first with full end-to-end type inference (routes, params, server function I/O).
- Clean integration with the rest of the TanStack family (Query, Form, Table, Virtual).
- SSR + API in a single bundle without Next-style adapter layers.
- Built for interactive apps, not content-heavy sites.

**Negative:**

- Younger than Next; some patterns are still maturing (pre-1.0 in places). Mitigated by [ADR-011](011-skill-currency-protocol.md) (Intent + MCP) keeping agent guidance current with installed versions.
- Smaller ecosystem of recipes, templates, and community examples than Next.js.
- React Server Components patterns are less mature here than in Next.
- Not the right pick for content-heavy sites (Astro fits that shape better).
