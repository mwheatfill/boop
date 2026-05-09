---
title: "ADR-0007: Auth provider abstraction (getCurrentUser)"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "All identity reads go through a getCurrentUser() abstraction in src/lib/auth/. Providers conform to the same interface."
---

# ADR-0007: Auth provider abstraction (getCurrentUser)

## Status

Accepted (2026-05-09)

## Context

The template supports two auth patterns ([ADR-0005](0005-better-auth-with-entra-default.md)): Better Auth + Entra OIDC (default) and Cloudflare Access (recipe). Without an abstraction, swapping is a rewrite — every route guard, server function auth check, and component personalization touches the provider directly.

Two failure modes to prevent:

- **Provider-coupled app code:** every route's `beforeLoad` imports `betterAuth`, every server function imports `auth.api.getSession`. The Cloudflare Access swap touches all of them.
- **Inconsistent identity shapes:** Better Auth's session has one shape, Cloudflare Access's JWT has another. The app's RBAC code branches on which is loaded.

## Decision

All identity reads go through `getCurrentUser(request)` exported from `src/lib/auth/get-current-user.ts`. Both providers implement the same interface and return the same `User` shape:

```ts
export type User = {
  id: string
  email: string
  name?: string
  groups: string[]
}

export async function getCurrentUser(request: Request): Promise<User | null>
```

Provider implementations live in `src/lib/auth/`:

- `better-auth-provider.ts` — default
- `cloudflare-access-provider.ts` — added by the swap recipe

The dispatcher in `get-current-user.ts` re-exports the active provider's implementation. Swapping providers is changing one re-export and removing unused code.

**Tenant context is deliberately not part of `User`.** Multi-tenant apps add a separate `getActiveTenant()` (or equivalent). The auth abstraction is identity-only.

**Dev-mode bypass lives in the provider, not the dispatcher.** Each provider's dev-mode reality differs (Better Auth in dev still works against the local DB; Cloudflare Access in dev has no edge-injected JWT). The bypass is in the provider implementation, gated on `import.meta.env.DEV`.

## Consequences

**Positive:**

- Provider swap is mechanical: change one re-export, remove unused route handlers and Drizzle session tables, configure Cloudflare Access in the dashboard. Estimated 30-60 minutes of work.
- App code (route guards, RBAC checks, UI personalization) stays provider-agnostic. Reads from `getCurrentUser()` and is durable across swaps.
- The abstraction is a stable place to add cross-cutting concerns: request-scoped caching, structured logging of identity reads, test doubles in unit tests.
- The `User` type lives in `src/shared/types/auth.ts` so client and server share it. UI personalization imports the type without pulling in provider code.

**Negative:**

- One extra layer of indirection. For trivial apps with one auth mode forever, this layer is overhead.
- The abstraction has to evolve carefully when providers add capabilities (e.g., MFA assertion claims) that don't fit the `User` shape. Add fields conservatively.

**Neutral / trade-off:**

- The HoopsLoop reference app uses `getSessionFn` (a TanStack Start server function) at the server-function layer. The template generalizes it one layer down to `getCurrentUser(request)` so it's reachable from `.well-known/` route handlers, middleware, and any context that has a `Request`. The HoopsLoop pattern is the working starting point; the template just lifts the boundary.

## Alternatives considered

- **Direct provider imports throughout the app** — every route guard and server function calls Better Auth directly. Provider swap rewrites every file. Lost on swap-ability.
- **Wrap only at server-function level (HoopsLoop's `getSessionFn`)** — works for server functions, doesn't reach `.well-known/` routes, middleware, or non-server-function request handlers. Lost on coverage.
- **Pass the `User` through context via a request middleware** — works, but the middleware needs to know which provider to call, recreating the dispatcher problem one level up. The current pattern is simpler.

## References

- Brief: `claude-code-brief.md`, "Auth" section, "Provider abstraction (template requirement)" subsection
- Findings: `docs/findings.md`, "Auth provider abstraction" in Decisions Locked section
- Recipe: `auth/swap-better-auth-for-cloudflare-access.md` (the consumer of this abstraction)
