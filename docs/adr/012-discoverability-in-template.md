---
title: "ADR-0009: Agent-ready discoverability surface"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
description: "robots.txt, sitemap, llms.txt, openapi.json, and two .well-known files ship in the template as static assets; the MCP server itself is a recipe."
---

# ADR-012: Agent-ready discoverability surface

## Status

Accepted (2026-05-09)

## What

The template ships a discoverability layer so apps are agent-discoverable from day one. Everything is a static file in `public/`, served by Cloudflare Workers Static Assets:

- `public/robots.txt`: AI-bot directives
- `public/sitemap.xml`: placeholder; replace with route-derived output once the app has more than a handful of routes
- `public/llms.txt`: agent-readable summary of the app
- `public/openapi.json`: generated from Zod schemas by `pnpm openapi:generate`
- `public/.well-known/api-catalog`: JSON linkset pointing at `/openapi.json`
- `public/.well-known/mcp-server-card`: placeholder; the `mcp/expose-app-as-mcp-server` recipe replaces it with real metadata when installed
- `public/_headers`: sets `Content-Type` for the extensionless `.well-known/*` files (`application/linkset+json` for `api-catalog`, `application/json` for `mcp-server-card`); without this, Cloudflare Workers Static Assets serves them as `application/octet-stream`

Recipes that need dynamic well-known endpoints (e.g., OAuth Protected Resource metadata that has to reflect runtime config) add an actual TanStack route file at `src/routes/[.]well-known/<name>.ts`, where `[.]` is the TanStack Router escape for a literal dot in the URL segment. The `auth/better-auth` recipe is the canonical example.

Total cost in the template: a handful of static files plus one `_headers` line each.

## When this default is right

Always. The surface is cheap and degrades gracefully when capabilities aren't installed (the MCP card stays a placeholder until the recipe wires it up; the auth metadata file is recipe-added rather than empty in the template).

## When to switch

Don't. Apps that genuinely have no agent surface still benefit from `robots.txt` and `sitemap.xml`. Removing the `.well-known/*` files is fine for apps that won't ever expose agent-callable surfaces, but the bytes are negligible.

## Notable

- **The MCP server itself is a recipe**, not in the template. Most apps don't need to be agent-callable from outside, and the server adds substantial code (auth wiring, transport handling). When the recipe is installed, it overwrites `public/.well-known/mcp-server-card` with real metadata.
- **Web Bot Auth verification** (cryptographic bot identity) is a planned recipe.
- **Markdown content negotiation** for public content surfaces is a planned recipe.
- **x402 / commerce protocols** are out of scope for this template's target apps.

## References

- [isitagentready.com](https://isitagentready.com/): the framework that informed this scope
- [OAuth Protected Resource spec](https://datatracker.ietf.org/doc/draft-ietf-oauth-resource-metadata/)
- [llms.txt convention](https://llmstxt.org/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [`mcp/expose-app-as-mcp-server`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/mcp/expose-app-as-mcp-server): recipe consumer
