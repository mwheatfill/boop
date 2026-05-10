# ADR-012: Agent-ready discoverability surface

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--09-blue)

## Context

Apps built on this template are increasingly accessed by agents (LLM clients, indexers, MCP-aware tools) as well as humans. Shipping the standard discovery surface (robots, sitemap, llms.txt, OpenAPI, `.well-known/*`) by default makes apps agent-discoverable from day one without a per-app effort. Skipping it means each app reinvents the surface or skips it, which makes the template harder to recommend to teams that want agent-readiness baked in.

## Decision

The template ships a discoverability layer as static files in `public/`, served by Cloudflare Workers Static Assets:

| File | Purpose |
|---|---|
| `public/robots.txt` | AI-bot directives |
| `public/sitemap.xml` | Placeholder; replace with route-derived output once the app has more than a handful of routes |
| `public/llms.txt` | Agent-readable summary of the app |
| `public/openapi.json` | Generated from Zod schemas by `pnpm openapi:generate` |
| `public/.well-known/api-catalog` | JSON linkset pointing at `/openapi.json` |
| `public/.well-known/mcp-server-card` | Placeholder; the [`mcp/expose-app-as-mcp-server`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/mcp/expose-app-as-mcp-server) recipe replaces it with real metadata when installed |
| `public/_headers` | Sets `Content-Type` for the extensionless `.well-known/*` files (Cloudflare Workers Static Assets serves them as `application/octet-stream` otherwise) |

Recipes that need dynamic well-known endpoints (e.g., OAuth Protected Resource metadata that has to reflect runtime config) add an actual TanStack route file at `src/routes/[.]well-known/<name>.ts`, where `[.]` is the TanStack Router escape for a literal dot. The `auth/better-auth` recipe is the canonical example.

## Consequences

**Positive:**

- Apps are agent-discoverable from day one with a handful of static files plus one `_headers` line each.
- Surface degrades gracefully when capabilities aren't installed (the MCP card stays a placeholder until the recipe wires it up).
- Recipes that need dynamic well-known endpoints have a clear pattern (TanStack escape route).

**Negative:**

- Apps that genuinely have no agent surface still ship the files. The bytes are negligible, but the conceptual surface is non-zero — engineers may wonder why `public/llms.txt` exists when their app is internal-only.

**Neutral / trade-off:**

- The MCP server itself is a recipe ([`mcp/expose-app-as-mcp-server`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/mcp/expose-app-as-mcp-server)), not in the template; most apps don't need to be agent-callable from outside, and the server adds substantial code (auth wiring, transport handling).
- Web Bot Auth verification (cryptographic bot identity) and markdown content negotiation for public content surfaces are planned recipes. x402 / commerce protocols are out of scope for this template's target apps.
