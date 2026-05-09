---
title: "ADR-0005: Better Auth as the auth library; providers via env"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
description: "Better Auth ships with email+password, email-OTP, social OAuth, and Entra OIDC all wired; env vars activate which providers are live."
---

# ADR-0005: Better Auth as the auth library; providers via env

## Status

Accepted (2026-05-09)

## What

Better Auth is the auth library. The template wires four authentication providers; each activates via env vars (no env vars → provider disabled):

- **Email + password** — universal default
- **Email-OTP** — passwordless via mailed code
- **Social OAuth** — Google, Apple, GitHub (configure the ones you want)
- **Entra OIDC** — Microsoft Entra ID for enterprise SSO

App code reads identity through `getCurrentUser(request)` ([ADR-0007](0007-auth-provider-abstraction.md)), so changing which providers are active doesn't touch route guards or server functions.

## When this default is right

- Apps needing authentication of any shape: consumer (email + social), enterprise (OIDC), or mixed
- Want session management, CSRF, RBAC hooks, and a Drizzle adapter out of the box
- Want to add or remove providers without touching app code

## When to switch

- Want Cloudflare Access fronting the app (uniform identity policy at the edge; loses per-app conditional-access targeting)
  - **Recipe:** [`auth/swap-better-auth-for-cloudflare-access.md`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/auth)
- Identity provider isn't OIDC-compatible and Better Auth has no plugin for it

## Notable

- Better Auth is the implementation detail. App code imports `getCurrentUser` from `src/lib/auth/`, never `better-auth` directly. The abstraction is the boundary; see [ADR-0007](0007-auth-provider-abstraction.md).
- `User` shape is identity-only (`id`, `email`, `name?`, `groups[]`). Multi-tenant apps add a separate `getActiveTenant()` rather than extending `User`.
- Group claims from OIDC (Entra groups, etc.) populate `User.groups`; app code does RBAC against those.

## References

- [Better Auth documentation](https://better-auth.com/)
- [Better Auth providers](https://better-auth.com/docs/authentication)
