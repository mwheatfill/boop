# ADR-006: Better Auth as the default auth recipe

![Status](https://img.shields.io/badge/status-Superseded%20for%20boop-yellow) ![Date](https://img.shields.io/badge/date-2026--05--09-blue)

**Note for boop:** Boop chose Cloudflare Access fronted by Entra OIDC instead of this default. See [ADR-026](026-cloudflare-access-with-entra-oidc.md) for the boop-specific decision and rationale. The content below remains accurate as the template-family default; only boop's implementation diverges.

## Context

The auth abstraction ([ADR-005](005-auth-provider-abstraction.md)) is empty until a recipe wires a real provider. Apps installed without picking carefully end up with hand-rolled session handling or import a heavy framework. The default recipe sets the floor: full-shape auth (consumer + enterprise) without forcing a choice up front.

## Decision

The template ships an empty `getCurrentUser(request)` and no auth library. Better Auth is the default opt-in implementation, installed via the [`auth/better-auth`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/auth/better-auth) recipe. The recipe replaces `getCurrentUser` with a Better Auth-backed body and adds env-driven configuration for the providers below; each activates only when its env vars are set:

- **Email + password**: universal default.
- **Email-OTP**: passwordless via mailed code.
- **Social OAuth**: Google, Apple, GitHub.
- **Entra OIDC**: Microsoft Entra ID for enterprise SSO.

App code reads identity through `getCurrentUser(request)` regardless of which provider is active, so swapping providers doesn't touch route guards or server functions. The `User` shape is identity-only (`id`, `email`, `name?`, `image?`, `groups[]`); group claims from OIDC populate `User.groups` for RBAC.

## Consequences

**Positive:**

- Covers any auth shape (consumer, enterprise, mixed) without picking a vendor up front.
- Session management, CSRF, RBAC hooks, and a Drizzle adapter ship with the recipe.
- Providers turn on/off via env vars; no app code change to swap them.

**Negative:**

- Apps that want Cloudflare Access fronting (uniform identity at the edge, loss of per-app conditional-access targeting) need to install the planned [`auth/cloudflare-access`](https://github.com/mwheatfill/app-platform-recipes#planned-recipes) recipe instead.
- Identity providers that aren't OIDC-compatible and don't have a Better Auth plugin need a different recipe.

**Neutral / trade-off:**

- The template's `src/lib/db/schema.ts` is empty by default; the recipe adds the auth tables and the corresponding Drizzle migration. Apps that don't install an auth recipe have an empty schema.
