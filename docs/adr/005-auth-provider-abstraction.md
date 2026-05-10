# ADR-005: Auth provider abstraction (`getCurrentUser`)

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--09-blue)

## Context

Apps swap auth providers (Better Auth → Cloudflare Access, add email-OTP, turn Entra on/off) more often than they swap data layers or runtimes. Without a stated boundary, swap day means hunting `import { auth }` calls across route guards, server functions, and RBAC checks. With one, swap day is replacing one file body.

## Decision

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

The Zod schema lives in `src/shared/schemas/auth.ts` (so it flows into `openapi.json`); the matching TypeScript type is re-exported from `src/shared/types/auth.ts` for client code that wants identity-shape types without server-only auth code. The default body returns `null`. An auth recipe ([`auth/better-auth`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/auth/better-auth) per [ADR-006](006-better-auth-with-entra-default.md), or planned `auth/cloudflare-access`) replaces the body with a real implementation conforming to the same `User` shape. App code (route guards, server functions, RBAC, UI personalization) reads only from `getCurrentUser` and never imports `better-auth` / `jose` / any provider directly.

## Consequences

**Positive:**

- Provider swap is mechanical: change one re-export in `get-current-user.ts`, remove unused route handlers, drop unused Drizzle session tables.
- App code is durable across provider changes and mode toggles.

**Negative:**

- The narrow `User` shape (identity-only) means auth-adjacent concerns (tenant, role expansion, profile) need their own functions or models. Multi-tenant apps add a separate `getActiveTenant()`; tenant context is deliberately not in `User`.
- Adding fields to `User` is a deliberate decision (touches the schema, the type, and every recipe), not silent extension.

**Neutral / trade-off:**

- Dev-mode bypass lives in the provider implementation, not in the dispatcher. Better Auth in dev works as-is. The Cloudflare Access provider (when activated by recipe) returns a configurable fake user gated on `import.meta.env.DEV` because `wrangler dev` doesn't traverse the edge that injects the `Cf-Access-Jwt-Assertion` header.
