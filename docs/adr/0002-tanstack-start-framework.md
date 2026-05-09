---
title: "ADR-0002: TanStack Start as the framework"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
description: "TanStack Start handles SSR, file-based routing, and API routes in a single bundle."
---

# ADR-0002: TanStack Start as the framework

## Status

Accepted (2026-05-09)

## What

TanStack Start is the framework. File-based routing via TanStack Router. SSR + API routes in one bundle. The Cloudflare Vite plugin handles the Workers deploy target.

## When this default is right

- TypeScript-first; full end-to-end type inference (routes, params, server function I/O)
- Already using TanStack Query, Form, Table, or Virtual, or want clean integration with them
- Want SSR + API in a single bundle without Next-style adapter layers
- Building an interactive app (not a content-heavy site)

## When to switch

- Need a much larger ecosystem of recipes, templates, or community examples (Next.js)
- Need React Server Components patterns with mature ecosystem support today
- Building a content-heavy site rather than an app (Astro)

## Notable

- TanStack Start is younger than Next; some patterns are still maturing. Pre-1.0 in places.
- TanStack Intent ([ADR-0010](0010-skill-currency-protocol.md)) keeps agent guidance current with installed versions, mitigating the API-churn cost.
- Server functions (`createServerFn`) collapse the call-server-from-client boundary into a typed import; HTTP API routes live alongside page routes in `src/routes/api/`.

## References

- [TanStack Start documentation](https://tanstack.com/start/latest)
- [TanStack Router documentation](https://tanstack.com/router/latest)
- [Cloudflare Vite plugin](https://github.com/cloudflare/workers-sdk/tree/main/packages/vite-plugin)
