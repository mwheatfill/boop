---
title: "ADR-0009: Agent-ready discoverability surface"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
description: "robots.txt, sitemap, llms.txt, and three .well-known endpoints ship in the template; the MCP server itself is a recipe."
---

# ADR-0009: Agent-ready discoverability surface

## Status

Accepted (2026-05-09)

## What

The template ships a discoverability layer so apps are agent-discoverable from day one:

- `public/robots.txt` — AI-bot directives
- `public/llms.txt` — agent-readable summary of the app
- `app/routes/sitemap.xml.ts` — generated from the TanStack Router route tree
- `app/routes/.well-known/api-catalog.ts` — links to the generated `openapi.json`
- `app/routes/.well-known/oauth-protected-resource.ts` — Better Auth OIDC metadata per the OAuth Protected Resource spec
- `app/routes/.well-known/mcp-server-card.ts` — returns 404 unless the MCP server recipe is installed; returns metadata once it is
- The Worker fetch handler adds `Link` response headers pointing at the well-known endpoints

Total cost: ~100 lines of route handlers reading from data the template already produces.

## When this default is right

Always. The surface is cheap and degrades gracefully when capabilities aren't installed (the MCP card just returns 404 until the recipe wires it up).

## When to switch

Don't. Apps that genuinely have no agent surface still benefit from `robots.txt` and `sitemap.xml`. Removing the `.well-known/*` files is fine for apps that won't ever expose agent-callable surfaces, but the bytes are negligible.

## Notable

- **The MCP server itself is a recipe**, not in the template. Most apps don't need to be agent-callable from outside, and the server adds substantial code (auth wiring, transport handling). When the recipe is installed, the discovery scaffolding announces it automatically.
- **Web Bot Auth verification** (cryptographic bot identity) is a recipe.
- **Markdown content negotiation** for public content surfaces is a recipe.
- **x402 / commerce protocols** are out of scope for this template's target apps.

## References

- [isitagentready.com](https://isitagentready.com/) — the framework that informed this scope
- [OAuth Protected Resource spec](https://datatracker.ietf.org/doc/draft-ietf-oauth-resource-metadata/)
- [llms.txt convention](https://llmstxt.org/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [`mcp/expose-app-as-mcp-server`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/mcp) — recipe consumer
