---
title: "ADR-0009: Discoverability surface in the template"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "robots.txt, sitemap, llms.txt, and three .well-known endpoints ship in the template. The MCP server itself is a recipe."
---

# ADR-0009: Discoverability surface in the template

## Status

Accepted (2026-05-09)

## Context

AI agents discovering an internal app benefit from standardized entry points: `robots.txt` for bot directives, sitemap for navigation, `llms.txt` for agent-readable summaries, and `.well-known/*` files for protocol-specific metadata. The framework at `isitagentready.com` formalizes this into five layers: discoverability, content accessibility, bot access control, protocol discovery, and commerce.

The question is what to ship in the template versus what to ship in recipes:

- **Discovery scaffolding** (robots, sitemap, `.well-known/*`): cheap to ship; a few hundred lines of route handlers reading from data the template already produces.
- **MCP server** (Worker-hosted server exposing the OpenAPI as agent tools): substantial code (200+ lines), auth wiring, transport handling. Most apps don't need to be agent-callable.
- **Web Bot Auth, content negotiation, x402 / commerce**: app-specific, not universal.

If shipping the MCP server in the template, every cloned app carries weight it doesn't need (the brief's tiebreaker rule says recipe). If shipping nothing, apps that do install MCP have to also wire up discovery — which is most of the work.

## Decision

**Ship in the template:**

- `public/robots.txt` with AI-bot directives.
- `app/routes/sitemap.xml.ts` generating from the TanStack Router route tree.
- `public/llms.txt` (auto-generated) summarizing the app for agents that don't speak MCP.
- `app/routes/.well-known/api-catalog.ts` linking to the generated `openapi.json`.
- `app/routes/.well-known/oauth-protected-resource.ts` (Better Auth OIDC metadata, per the OAuth Protected Resource spec).
- `app/routes/.well-known/mcp-server-card.ts` (returns 404 unless the MCP server recipe is installed; returns metadata once it is).
- The Worker fetch handler adds `Link` response headers pointing at the well-known endpoints.

**Ship in recipes (not the template):**

- `mcp/expose-app-as-mcp-server.md` — the actual MCP server. When installed, the discovery scaffolding announces it automatically.
- Web Bot Auth verification.
- Markdown content negotiation for public content surfaces.
- x402 / commerce protocols (out of scope for internal apps anyway).

## Consequences

**Positive:**

- Apps cloned from the template are agent-discoverable from day one. Any agent that probes `.well-known/` finds the right pointers.
- Cheap: total cost is around 100 lines of route handlers reading from data the template already produces (`openapi.json`, Better Auth metadata, etc.).
- Degrades gracefully: discovery files exist whether or not the MCP server recipe is installed; the MCP card just returns 404 when MCP isn't wired up.
- The keystone (`openapi.json`) feeds multiple consumers: MCP server, agent tools, generated SDK clients, AI agents reading the API surface.

**Negative:**

- Small ongoing maintenance as well-known specs evolve (OAuth Protected Resource has revisions; MCP server card spec is still maturing).
- Apps that genuinely have no agent surface still ship these files. The bytes are negligible, but the maintenance surface isn't zero.

**Neutral / trade-off:**

- The "MCP server itself" decision applies the brief's load-bearing principle: most apps won't need to be agent-callable, so the server is a recipe. Apps that do need it pay only the recipe-application cost.

## Alternatives considered

- **No discovery surface in the template** — apps stay silent until someone manually wires `.well-known/*`. Most apps would never get around to it. Lost on day-one agent friendliness.
- **Discovery + MCP server both in the template** — every cloned app carries the MCP code even when not used. Brief's tiebreaker rule says no. Lost on weight.
- **Only `robots.txt` and `sitemap.xml`** (the bare minimum) — misses the protocol-discovery layer where most agent value lives. Lost on completeness for the cheap part.

## References

- [isitagentready.com](https://isitagentready.com/) — the framework that informed this scope
- [OAuth Protected Resource spec](https://datatracker.ietf.org/doc/draft-ietf-oauth-resource-metadata/)
- [llms.txt convention](https://llmstxt.org/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- Recipe: `mcp/expose-app-as-mcp-server.md` (port of the existing `+mcp-server` Azure recipe)
- Brief: `claude-code-brief.md`, "Agent-ready surface" section
