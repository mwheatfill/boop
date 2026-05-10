---
title: "ADR-0007: Auth provider abstraction (getCurrentUser)"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
description: "All identity reads go through getCurrentUser(request) in src/lib/auth/. Providers conform to one interface."
---

# ADR-005: Auth provider abstraction (getCurrentUser)

## Status

Accepted (2026-05-09)

## What

All identity reads go through `getCurrentUser(request)` exported from `src/lib/auth/get-current-user.ts`:

```ts
type User = {
  id: string
  email: string
  name?: string
  image?: string
  groups: string[]
}

export async function getCurrentUser(request: Request): Promise<User | null>
```

The Zod schema lives in `src/shared/schemas/auth.ts` (so it flows into `openapi.json`) and the matching TypeScript type is re-exported from `src/shared/types/auth.ts` so client code can import the type for UI personalization without pulling in server-only auth code.

The default body of `getCurrentUser` returns `null`. An auth recipe (e.g. `auth/better-auth`, planned `auth/cloudflare-access`) replaces the body with a real implementation that conforms to the same `User` shape.

## When this default is right

Always. App code (route guards, server functions, RBAC checks, UI personalization) reads only from `getCurrentUser`. App code does not import `better-auth`, `jose`, or any other provider-specific module directly.

## When to switch

Don't. The point of the abstraction is durability across provider swaps and mode changes (Better Auth → Cloudflare Access; adding email-OTP; turning Entra on/off).

## Notable

- **Tenant context is deliberately not in `User`.** Multi-tenant apps add a separate `getActiveTenant()` (or equivalent). The auth abstraction is identity-only.
- **Dev-mode bypass lives in the provider implementation, not the dispatcher.** Better Auth in dev works as-is. The Cloudflare Access provider (when activated by recipe) returns a configurable fake user gated on `import.meta.env.DEV` because `wrangler dev` doesn't traverse the edge that injects the `Cf-Access-Jwt-Assertion` header.
- **Provider swap (Better Auth → Cloudflare Access) is mechanical:** change one re-export in `get-current-user.ts`, remove unused route handlers, drop unused Drizzle session tables.
- **The `User` shape is intentionally narrow.** Adding fields is a deliberate decision; agents and developers should propose the addition rather than extending silently.

## References

- [`agent-rules/architecture.md`](../../agent-rules/architecture.md): auth section
- [`auth/better-auth`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/auth/better-auth): default recipe consumer of this abstraction
- Planned `auth/cloudflare-access`: alternate provider behind the same abstraction
