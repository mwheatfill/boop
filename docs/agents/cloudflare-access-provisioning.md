# Cloudflare Access provisioning (operator runbook)

Boop's `getCurrentUser(request)` validates a `Cf-Access-Jwt-Assertion` header that Cloudflare Access attaches to every request after the user authenticates. This file documents the platform-side provisioning the Worker code can't do on its own: creating the Access application, wiring the Entra OIDC identity provider, and setting the per-environment secrets.

The Worker-side code already exists at `src/lib/auth/` (verify-access-jwt, get-current-user, provision-user, dev-bypass). It is the implementation behind the [`auth/cloudflare-access`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/auth/cloudflare-access) recipe pattern. See [ADR-026](../adr/026-cloudflare-access-with-entra-oidc.md).

## Prerequisites

- Cloudflare account with Zero Trust enabled.
- Entra ID admin access to the tenant that owns the operators (SwitchThink tenant).
- `wrangler` CLI authenticated to the Cloudflare account (`wrangler login` once per machine).
- The deployed Worker URL for the environment you are provisioning. For `boop-dev` this is `boop-dev.<account-subdomain>.workers.dev` unless a custom domain is bound.

## 1. Register the OIDC app in Entra

In the Entra admin centre → **Identity → Applications → App registrations → New registration**:

| Field | Value |
| --- | --- |
| Name | `boop-dev` (or `boop-prod`) |
| Supported account types | Single tenant |
| Redirect URI (Web) | `https://<your-team-name>.cloudflareaccess.com/cdn-cgi/access/callback` |

Click **Register**. From the Overview page, capture:

- **Application (client) ID**
- **Directory (tenant) ID**

Then under **Certificates & secrets → New client secret**, create one and copy its **Value** immediately (it's only shown once). That's the OIDC client secret Access will use.

Under **Token configuration → Add groups claim**, include `Security groups` so Entra sends a `groups` claim. (Optional now — boop's `User.role` is derived from a hardcoded admin email list today; group-based RBAC is a future hook.)

## 2. Add Entra as a Cloudflare Access IdP

Cloudflare dashboard → **Zero Trust → Settings → Authentication → Login methods → Add new → OpenID Connect**:

| Field | Value |
| --- | --- |
| Name | `Entra (SwitchThink)` |
| App ID | the Application (client) ID from step 1 |
| Client secret | the secret Value from step 1 |
| Auth URL | `https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/authorize` |
| Token URL | `https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token` |
| Certificate URL | `https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys` |
| OIDC Claims | `email`, `name`, `groups` |
| Scopes | `openid profile email` |

**Test** the IdP from this same screen before continuing. Cloudflare opens the Entra consent flow; expect a successful redirect back showing your identity claims.

## 3. Create the Access application

Zero Trust → **Access → Applications → Add an application → Self-hosted**:

| Field | Value |
| --- | --- |
| Application name | `boop-dev` |
| Session duration | 24 hours (sane default; bump for less-friction internal tooling) |
| Application domain | `boop-dev.<account-subdomain>.workers.dev` (or your custom domain) |
| Identity providers | check the Entra IdP from step 2 |

On the next screen, **Add a policy**:

| Field | Value |
| --- | --- |
| Policy name | `Allow SwitchThink operators` |
| Action | Allow |
| Include rule | Emails ending in `@switchthink.com` (or a specific Entra group once group claims are wired) |

Save the application.

## 4. Capture the AUD tag and Team Domain

From the saved Access application → **Configure → Overview → Application Audience (AUD) Tag**: a UUID-like string. This is `POLICY_AUD`.

From Zero Trust → **Settings → Custom Pages**, or any URL under your Zero Trust dashboard, the team domain is `https://<your-team-name>.cloudflareaccess.com`. That's `TEAM_DOMAIN`.

## 5. Set the wrangler secrets

For the dev Worker:

```bash
wrangler secret put TEAM_DOMAIN     # paste https://<team>.cloudflareaccess.com
wrangler secret put POLICY_AUD      # paste the AUD tag from step 4
```

For production, repeat with `--env production`:

```bash
wrangler secret put TEAM_DOMAIN --env production
wrangler secret put POLICY_AUD --env production
```

Each environment has its own Access application (different AUD), so `POLICY_AUD` differs between dev and prod. `TEAM_DOMAIN` is the same across all environments under one Cloudflare account.

Verify with:

```bash
wrangler secret list                    # boop-dev
wrangler secret list --env production   # boop-prod
```

Both `TEAM_DOMAIN` and `POLICY_AUD` must appear (the list shows names, not values).

## 6. Local development

The local `pnpm dev` Worker runs without Access in front, so no JWT is attached. `getCurrentUser` falls back to `devBypassUser` when `PUBLIC_ENV=dev` and `DEV_USER_EMAIL` is set in `.dev.vars` (`src/lib/auth/dev-bypass.ts`). The bypass logs a warning on each use and is hard-gated to `PUBLIC_ENV=dev`.

To exercise the real Access flow locally, hit the deployed dev URL through your browser. Cloudflare intercepts the request, redirects to Entra, and on success attaches the JWT before the Worker sees the request.

## 7. End-to-end verification

```bash
curl -i https://boop-dev.<account-subdomain>.workers.dev/me
```

Without authentication you should get a 302 to the Entra login flow (Access intercepting), not a 200 from the Worker. After authenticating in a browser, the Worker receives the JWT, `verifyAccessJwt` validates against the JWKS at `${TEAM_DOMAIN}/cdn-cgi/access/certs`, `provisionUser` upserts the User row, and `/me` returns the operator identity.

If the Worker still returns 401 / 403 after a successful Entra login, the most common causes are:

- **AUD mismatch**: `POLICY_AUD` set on the Worker doesn't match the Access application's AUD tag.
- **Team domain typo**: `TEAM_DOMAIN` missing the `https://` prefix or has a trailing slash. Should be exactly `https://<your-team-name>.cloudflareaccess.com` (no path, no trailing slash).
- **JWKS cache cold start**: the first JWKS fetch can take ~1s; subsequent calls are cached in-process. Not a real failure mode, just a one-time latency.

`wrangler tail --env <env>` streams the Worker logs. Look for `auth.verify_failed` with a `kind` field (`audience`, `issuer`, `signature`, `expired`, `jwks_fetch`) for a precise diagnosis.

## What this runbook does NOT cover

- **Group claim → role mapping.** Boop currently derives `role` from a hardcoded admin email list in `src/lib/auth/is-admin.ts`. Wiring Entra group claims into `User.role` is a separate piece of work.
- **Service tokens.** For machine-to-machine traffic (CI calls into a deployed Worker), Access service tokens issue JWTs with an empty `sub`. Not in scope for operator SSO.
- **Conditional Access policies.** Entra's per-app CA (require MFA, device compliance, etc.) is configured on the Entra app registration; once set, Cloudflare Access honors whatever Entra decides.

## References

- Recipe README: [`auth/cloudflare-access`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/auth/cloudflare-access)
- Cloudflare docs: [Validate JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- Cloudflare docs: [Generic OIDC integration](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/generic-oidc/)
- [ADR-005](../adr/005-auth-provider-abstraction.md) — `getCurrentUser` abstraction
- [ADR-026](../adr/026-cloudflare-access-with-entra-oidc.md) — Cloudflare Access (fronted by Entra OIDC) is the actual implementation
