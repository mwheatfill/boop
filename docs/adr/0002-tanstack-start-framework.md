---
title: "ADR-0002: TanStack Start as the framework"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "TanStack Start is the SSR + API-routing framework for apps cloned from this template."
---

# ADR-0002: TanStack Start as the framework

## Status

Accepted (2026-05-09)

## Context

Given Cloudflare Workers as the runtime ([ADR-0001](0001-cloudflare-workers-runtime.md)), we need a SSR-capable React framework that:

- Generates clean, type-safe routes from files.
- Has first-class type-safe data loading.
- Bundles cleanly to a single Worker.
- Doesn't lock the app into a single deployment target.
- Has good DX for TypeScript-heavy teams.

The TanStack ecosystem is already in use (Query, Form, Table, Virtual). Continuing with TanStack at the framework layer keeps the type-safe story unified end-to-end.

## Decision

TanStack Start is the framework. File-based routing via TanStack Router. SSR + API routes in one bundle. The Cloudflare Vite plugin handles the Workers deploy target.

## Consequences

**Positive:**

- Type-safe end-to-end: routes, params, search, server function inputs and outputs all flow through TypeScript.
- File-based routing is ergonomic and discoverable for both humans and AI agents.
- API routes live alongside page routes (`src/routes/api/`), which collapses the conceptual surface from "pages + a separate API server" to "one route tree."
- Server functions (`createServerFn`) collapse the call-server-from-client boundary into a typed import.
- Bundles cleanly to a Cloudflare Worker via the official `@cloudflare/vite-plugin`.

**Negative:**

- Smaller community than Next.js. Fewer Stack Overflow answers, fewer tutorial blog posts.
- Pre-1.0 in some areas. APIs evolve; TanStack Intent helps keep agent guidance current with installed versions ([ADR-0010](0010-skill-currency-protocol.md)).
- Not every Next-ecosystem library has a TanStack-native equivalent. Most do; the gaps are small.

**Neutral / trade-off:**

- Choosing TanStack Start ties the template to that ecosystem's release cadence. The watch-list note in the AI provider section of the brief documents the eventual migration to TanStack AI when it stabilizes.

## Alternatives considered

- **Next.js (App Router)** — large ecosystem and excellent DX, but heavier deploy footprint, less straightforward Cloudflare Workers deploy story (works via OpenNext, but adds an adapter layer), and the App Router conventions felt less type-safe-by-default than TanStack's. Lost on the runtime integration story.
- **Remix (now React Router framework)** — similar shape, similar quality, smaller momentum on Cloudflare specifically. Lost on ecosystem alignment with the rest of the TanStack stack already chosen.
- **Astro** — excellent for content-heavy sites; not the right fit for app-style internal tools with heavy interactivity. Lost on app fit.
- **Hono + custom React SSR** — too DIY. Loses the framework's batteries-included story. Reserved as a fallback if TanStack Start ever stops working on Workers.

## References

- [TanStack Start documentation](https://tanstack.com/start/latest)
- [TanStack Router documentation](https://tanstack.com/router/latest)
- [Cloudflare Vite plugin](https://github.com/cloudflare/workers-sdk/tree/main/packages/vite-plugin)
- Brief: `claude-code-brief.md`, "Compute and runtime" section
