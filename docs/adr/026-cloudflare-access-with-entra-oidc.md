# ADR-026: Cloudflare Access (fronted by Entra OIDC) is boop's auth implementation

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--13-blue)

Supersedes the implementation half of [ADR-006](006-better-auth-with-entra-default.md). ADR-005's `getCurrentUser` abstraction is unchanged.

## Context

ADR-006 picked Better Auth as the default auth recipe for the template family, with Cloudflare Access named as a planned alternate. Boop's actual implementation went the other way: the [`auth/cloudflare-access`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/auth/cloudflare-access) recipe pattern, fronted by Microsoft Entra OIDC, with an admin-role middleware layer added on top.

The reasons that pushed boop off the ADR-006 default:

- **Operators are SwitchThink employees with Entra accounts.** Cloudflare Access fronting Entra is identity-at-the-edge — operators are authenticated before the Worker sees the request. Better Auth's value (multi-provider session handling, social OAuth, password flows) doesn't apply to an internal-only operator tool.
- **No password storage.** Better Auth would mean managing password hashes, session tokens, MFA enrollment in our D1. Access offloads all of that to Entra and the CF edge.
- **Conditional Access targeting is a feature, not a loss.** ADR-006 framed Access fronting as a downside ("loss of per-app conditional-access targeting"). For boop's operator scope, Entra's per-app CA (device compliance, MFA, location) is exactly the wanted behavior — apply at the Entra app registration, Access honors it.
- **Operational model fits.** ADR-001 / ADR-002 already commit to Cloudflare Workers + TanStack Start. Cloudflare Access is the same platform's identity primitive. Nothing else to deploy.

## Decision

| Concern | Choice | Over |
|---|---|---|
| Auth abstraction | Unchanged from [ADR-005](005-auth-provider-abstraction.md). All identity reads go through `getCurrentUser(request, env)` returning `User \| null`. No call site imports `jose` or reads the JWT header directly. | Direct JWT reads in route guards. |
| Provider | **Cloudflare Access** fronting **Microsoft Entra OIDC**. Implements the [`auth/cloudflare-access`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/auth/cloudflare-access) recipe pattern in `src/lib/auth/`. Validates the `Cf-Access-Jwt-Assertion` header against the team's JWKS using `jose@^6` (Cloudflare's canonical Workers JWT library per their [official tutorial](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)). | Better Auth (ADR-006 default — overhead doesn't pay off for an internal tool); hand-rolled OAuth in the Worker; SWA EasyAuth (we're not on Azure SWA). |
| Env vars | `TEAM_DOMAIN` (e.g. `https://<team>.cloudflareaccess.com`) and `POLICY_AUD` (the Access application's AUD tag) live in `wrangler.jsonc` `secrets.required`. Each environment has its own Access application, so `POLICY_AUD` differs per env; `TEAM_DOMAIN` is shared. | `vars` block (per Cloudflare's example) — using `secrets.required` matches boop's existing convention for env-specific config (`BOOP_SECRETS_KEK`). |
| Dev bypass | `src/lib/auth/dev-bypass.ts` falls back to a user assembled from `DEV_USER_EMAIL` when `PUBLIC_ENV=dev` and no JWT is present. Hard-gated by `PUBLIC_ENV=dev` so it cannot activate in production. | Running Access locally (cloudflared tunnel during dev — too much friction for the inner loop); accepting `null` user during local dev (every guarded surface 401s). |
| Role assignment | `src/lib/auth/is-admin.ts` checks the user email against a hardcoded admin list. Group-claim-driven role assignment is a queued follow-up. | Entra group claim → role mapping today (works, but introduces an Entra-side dependency before the basic flow is verified). |
| Provisioning runbook | Project-local at [`docs/agents/cloudflare-access-provisioning.md`](../agents/cloudflare-access-provisioning.md). Operator-facing, not agent-facing. Steps: register OIDC app in Entra, add as CF Access IdP, create Access application, set AUD-tag/team-domain wrangler secrets, verify with `wrangler tail`. | A README section in the recipe alone — runbook needs to track boop-specific values (worker name, dev URL, admin email rules) the recipe README doesn't carry. |

## Consequences

**Positive:**

- Zero auth code in the Worker except JWT validation + user provisioning. No session tables, no password hashes, no MFA enrollment, no rotation logic.
- Identity policy lives at the edge. Adding a new Entra group → policy update in Cloudflare Access dashboard, no Worker redeploy.
- The abstraction ([ADR-005](005-auth-provider-abstraction.md)) holds. Swapping to Better Auth later is a per-environment recipe install + replacing `src/lib/auth/`'s body; route guards and server functions stay untouched.
- Per-app Conditional Access via Entra. Operators get whatever device-compliance / MFA / location policy the SwitchThink Entra tenant requires for this app specifically.

**Negative:**

- **Two systems to provision** before the app is reachable: an Entra app registration and a Cloudflare Access application. Documented in the runbook; not on the developer's inner-loop path.
- **Local dev requires the bypass.** `pnpm dev` runs the Worker behind localhost without Access; the bypass is the only path to a non-null `User` locally. Hard-gating to `PUBLIC_ENV=dev` prevents accidental leakage.
- **Service-token traffic** (CI calls into a deployed Worker for smoke tests, scheduled remote agents) needs a separate path — service-token JWTs have empty `sub` and don't slot into `getCurrentUser` cleanly. Not in scope here.

**Neutral / trade-off:**

- ADR-006's content still describes the template's default and the planned options. We don't delete it; we mark it superseded by this ADR for boop specifically. Future apps cloning the template inherit ADR-006's default and pick their own auth path.
- `User.groups` is unpopulated today (boop's `User` shape omits it). Adding groups + group-driven RBAC is a follow-up issue.
- The `auth/cloudflare-access` recipe's installer was not run against boop's tree — the equivalent code was hand-rolled to the same pattern, with boop-specific extensions (`provision-user.ts`, `admin-middleware.ts`, `require-admin.ts`, `is-admin.ts`). Re-running the installer would conflict; treat the recipe README as the source of truth for the pattern and the installer as not-applicable here.
