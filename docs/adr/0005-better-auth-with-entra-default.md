---
title: "ADR-0005: Better Auth + Entra OIDC default; Cloudflare Access via recipe"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "Better Auth handles in-app OIDC against Entra by default. Cloudflare Access is documented as a swap recipe."
---

# ADR-0005: Better Auth + Entra OIDC default; Cloudflare Access via recipe

## Status

Accepted (2026-05-09)

## Context

SwitchThink uses Microsoft Entra ID for identity. Conditional Access policies attach per Entra application registration, so per-app CA targeting (standard MFA for one app, phishing-resistant MFA for another) requires per-app Entra registrations.

Two viable patterns:

- **OIDC-in-app:** each app registration is its own Entra app; the app handles the OIDC redirect flow, session cookies, and validation. Per-app CA targeting works naturally.
- **Cloudflare Access:** a single Entra registration shared across multiple apps protected by Cloudflare Access. The Worker reads `Cf-Access-Jwt-Assertion`. Uniform CA policy across all apps; loses per-app targeting.

The right pattern is app-dependent. The template needs a default and a clean swap path.

## Decision

**Default: OIDC-in-app via Better Auth.** Each cloned app gets its own Entra app registration. Better Auth handles OIDC, sessions, and validation. The app reads identity from the session via the `getCurrentUser()` abstraction ([ADR-0007](0007-auth-provider-abstraction.md)).

**Alternative: Cloudflare Access.** Documented as `auth/swap-better-auth-for-cloudflare-access.md` recipe. Apps choose this on day one if uniform CA policy is acceptable.

## Consequences

**Positive:**

- Per-app Conditional Access targeting works naturally. SwitchThink can apply MFA to one app and phishing-resistant MFA to another without splitting Cloudflare Access groups.
- Identity stays in Entra. App-level RBAC reads Entra group claims; no separate identity store.
- Better Auth provides a clean OIDC implementation, session management, and Drizzle adapter.
- The auth abstraction means swapping to Cloudflare Access is mechanical when an app prefers that model.

**Negative:**

- More moving parts than Cloudflare Access (which delegates everything to the edge). Each app maintains its own Entra registration, OIDC config, and session store.
- Better Auth is younger than Auth.js. APIs occasionally shift; pin carefully.
- Local development requires the OIDC flow to work, which means a local Entra app registration (or a dev-friendly bypass).

**Neutral / trade-off:**

- "Conditional Access is the single policy engine" is the governing principle. App-level RBAC (group-claim-based) is independent of identity policy and lives in app code regardless of which auth pattern is used.

## Alternatives considered

- **Cloudflare Access default** — simpler app code (no auth flow to maintain), but loses per-app CA targeting for SwitchThink's pattern. Lost on policy granularity. Documented as a swap recipe for apps where this trade is the right one.
- **Auth.js (NextAuth)** — works in TanStack Start but has weaker Entra-specific tooling and a less clean adapter pattern for Drizzle. Lost on integration ergonomics.
- **Clerk / Auth0** — excellent DX, but pulls identity out of Entra (or requires an Entra-as-IdP setup that adds latency). Lost on identity coherence with the rest of SwitchThink's M365 stack. Cost is also a factor for many small apps.
- **DIY OIDC** — high foot-gun. Lost on security risk vs. value.

## References

- [Better Auth documentation](https://better-auth.com/)
- [Microsoft Entra ID OIDC](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)
- [Cloudflare Access documentation](https://developers.cloudflare.com/cloudflare-one/identity/applications/)
- Recipe: `auth/swap-better-auth-for-cloudflare-access.md`
- Brief: `claude-code-brief.md`, "Auth" section
