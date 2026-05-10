---
title: "ADR-0005: Better Auth as the default auth recipe"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
description: "Better Auth is the default provider behind the getCurrentUser abstraction; the template ships the abstraction empty and an opt-in recipe wires Better Auth with email+password, email-OTP, social OAuth, and Microsoft Entra OIDC behind env-driven config."
---

# ADR-0005: Better Auth as the default auth recipe

## Status

Accepted (2026-05-09)

## What

The template ships an empty `getCurrentUser(request)` ([ADR-0007](0007-auth-provider-abstraction.md)) and no auth library. Better Auth is the default opt-in implementation, installed via the [`auth/better-auth`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/auth/better-auth) recipe. That recipe replaces `getCurrentUser` with a Better Auth-backed body and adds env-driven configuration for the providers below; each one activates only when its env vars are set:

- **Email + password**: universal default
- **Email-OTP**: passwordless via mailed code
- **Social OAuth**: Google, Apple, GitHub (configure the ones you want)
- **Entra OIDC**: Microsoft Entra ID for enterprise SSO

App code reads identity through `getCurrentUser(request)` regardless of which recipe is installed, so swapping providers doesn't touch route guards or server functions.

## When this default is right

- Apps needing authentication of any shape: consumer (email + social), enterprise (OIDC), or mixed
- Want session management, CSRF, RBAC hooks, and a Drizzle adapter out of the box
- Want to add or remove providers without touching app code

## When to switch

- Want Cloudflare Access fronting the app (uniform identity policy at the edge; loses per-app conditional-access targeting). Use the planned `auth/cloudflare-access` recipe.
- Identity provider isn't OIDC-compatible and Better Auth has no plugin for it.

## Notable

- Better Auth is the implementation detail. App code imports `getCurrentUser` from `src/lib/auth/`, never `better-auth` directly. The abstraction is the boundary; see [ADR-0007](0007-auth-provider-abstraction.md).
- The template's `src/lib/db/schema.ts` is empty by default; the `auth/better-auth` recipe adds the auth tables and ships the corresponding Drizzle migration.
- `User` shape is identity-only (`id`, `email`, `name?`, `image?`, `groups[]`). Multi-tenant apps add a separate `getActiveTenant()` rather than extending `User`.
- Group claims from OIDC (Entra groups, etc.) populate `User.groups`; app code does RBAC against those.

## References

- [Better Auth documentation](https://better-auth.com/)
- [Better Auth providers](https://better-auth.com/docs/authentication)
- [`auth/better-auth` recipe](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/auth/better-auth)
