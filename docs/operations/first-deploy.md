# First deploy

One-time setup to bring boop up on a fresh Cloudflare account. Subsequent deploys ride [`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml) on every `v*.*.*` tag push (and via `workflow_dispatch`).

## Prerequisites

- Cloudflare account with Workers Paid (D1, R2, Queues, Durable Objects, Access are all in-scope).
- A zone you control attached to that account. Access cannot gate `*.workers.dev`.
- `wrangler` CLI signed in: `pnpm exec wrangler login`.
- GitHub repo admin access to set Actions secrets.

## 1. Create the Cloudflare resources

This repo's `wrangler.jsonc` `env.production` block already names these resources. On a fresh account, you'll re-run the create commands and paste the new `database_id` into `env.production.d1_databases[0].database_id`.

```sh
pnpm exec wrangler d1 create boop-prod
# → paste the returned `database_id` into wrangler.jsonc env.production.d1_databases[0].database_id

pnpm exec wrangler r2 bucket create boop-bodies-prod

pnpm exec wrangler queues create boop-dispatch-prod
pnpm exec wrangler queues create boop-dispatch-dlq-prod
pnpm exec wrangler queues create boop-alerts-prod
pnpm exec wrangler queues create boop-alerts-dlq-prod
```

The dev environment (top-level `wrangler.jsonc` block, used by `deploy-dev`) needs the matching `-dev` siblings:

```sh
pnpm exec wrangler d1 create boop-dev
pnpm exec wrangler r2 bucket create boop-bodies-dev
pnpm exec wrangler queues create boop-dispatch-dev
pnpm exec wrangler queues create boop-dispatch-dlq-dev
pnpm exec wrangler queues create boop-alerts-dev
pnpm exec wrangler queues create boop-alerts-dlq-dev
```

Durable Object class registration happens automatically on the first `wrangler deploy --env production`.

## 2. Wire the custom domain

Pick the production hostname (e.g. `boop.example.com`). The hostname must sit on a Cloudflare zone you control.

Two ways to attach the route to the Worker:

- **Dashboard.** Workers & Pages → boop-prod → Settings → Triggers → Custom Domains → Add. Cloudflare provisions the DNS record and SSL cert automatically.
- **Wrangler config.** Add a `routes` block under `env.production` and re-deploy:

  ```jsonc
  "routes": [{ "pattern": "boop.example.com/*", "zone_name": "example.com" }]
  ```

The dashboard path keeps DNS lifecycle out of git.

## 3. Create the two Cloudflare Access Applications

Per the [Cloudflare Access "Bypass a public endpoint" docs](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/#bypass-a-public-endpoint), public endpoints inside a gated application require two separate Applications scoped by path. Bypass policies do not log requests and do not enforce identity, so the gated app stays the default and the bypass app covers only the public path.

### App #1: Operator UI (gated)

| Field | Value |
| --- | --- |
| Application type | Self-hosted |
| Application name | `boop operator UI` |
| Domain | `boop.example.com` |
| Path | `*` (or blank for the full domain) |
| Identity provider | Entra (or whichever IdP the org uses) |
| Session duration | 24h (recommended) |

Policy:

| Action | Rule type | Selector | Value |
| --- | --- | --- | --- |
| Allow | Include | Emails ending in | `@switchthink.com` (or the Entra group equivalent) |

After saving, copy the **Application Audience (AUD) tag** from the Application's Overview tab. `src/lib/auth/verify-access-jwt.ts` matches against it. The value goes into the `CF_ACCESS_AUD` secret in step 5.

### App #2: Webhook receiver (bypassed)

| Field | Value |
| --- | --- |
| Application type | Self-hosted |
| Application name | `boop webhook receiver` |
| Domain | `boop.example.com` |
| Path | `w/*` |

Policy:

| Action | Rule type | Selector | Value |
| --- | --- | --- | --- |
| Bypass | Include | Everyone | Everyone |

This makes `boop.example.com/w/$customerSlug/$jobSlug` reachable without an Access JWT. Requests to `/w/*` are not logged by Access; webhook hardening (PRD #24) adds HMAC verification and rate limiting at the application layer to compensate.

Naming both Applications clearly is load-bearing. A future operator who edits the wrong one can break auth or webhook reachability silently.

## 4. Set the GitHub Actions secrets

In the repo settings → Secrets and variables → Actions → New repository secret:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | An API token scoped to **Edit Cloudflare Workers** on the production account only (Cloudflare dashboard → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template). |
| `CLOUDFLARE_ACCOUNT_ID` | The account id (Cloudflare dashboard → Workers & Pages → right-hand sidebar). |

The token's account scope contains the blast radius. A leaked CI token cannot edit other accounts. Rotate via the dashboard; no code change required because the workflow reads from `secrets.*`.

## 5. Set the production Worker secrets

After the first deploy succeeds, set the Worker secrets via [`wrangler secret put`](https://developers.cloudflare.com/workers/configuration/secrets/):

```sh
pnpm exec wrangler secret put CF_ACCESS_AUD --env production
# → paste the AUD from Access App #1's Overview tab
```

`wrangler secret put` creates a new Worker version and deploys it immediately. Subsequent application deploys inherit the secret. `wrangler secret list --env production` verifies.

## 6. First deploy

Cut a release tag and push:

```sh
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/deploy-production.yml` triggers on `v*.*.*` tags:

1. Quality gates: `pnpm check`, `pnpm build`, `pnpm test`, `pnpm openapi:check`, `pnpm audit:patterns`.
2. Apply D1 migrations to the production database via `pnpm exec wrangler d1 migrations apply DB --env production --remote`. Drizzle's `_journal.json` ledger makes this idempotent.
3. Deploy via `cloudflare/wrangler-action@v3` with `CLOUDFLARE_ENV=production` exported. The Vite build merges `env.production` into `dist/server/wrangler.json`; the deploy step runs `wrangler deploy` against the merged config.

The Actions tab surfaces the deployed worker URL and version id. Durable Object class registration happens automatically on this first deploy.

## 7. Smoke-test the deploy

Sign-in path:

1. Visit `https://boop.example.com/`.
2. Cloudflare Access redirects to the Entra IdP.
3. Sign in.
4. Land on the home page. The first user is auto-promoted to Admin per ADR-016; the empty state reads "Welcome to boop. Create your first Customer to get started."

Webhook-bypass path (after at least one webhook-typed Job exists):

```sh
curl -i https://boop.example.com/w/<customer-slug>/<job-slug>
# → 200 once a matching Job exists; 404 otherwise. No Access JWT required.
```

Dispatch path: create a cron Job through the UI, wait one minute, observe a Run land on the Job detail page from PRD #16 slice 2.

## 8. Rollback

Manual until a health-check primitive exists.

```sh
pnpm exec wrangler deployments list --env production
pnpm exec wrangler rollback --env production
# → rolls back to the previous deployment. Pass a version id to roll back further.
```

Gradual deployments (versioned ramps via `wrangler versions deploy`) are deferred. Cut a fresh tag and let the workflow redeploy when the regression is fixed.

## What's not in this runbook

- **Staging environment** (`env.staging`). Future PRD.
- **Workers Logs subscription, Sentry, OTel.** Per AGENTS.md, monitoring recipes overlay observability without touching call sites. Default `logInfo`/`logWarn`/`logError` ships to Workers Logs without extra config.
- **Webhook signature verification + rate limiting.** Covered by [PRD #24](https://github.com/mwheatfill/boop/issues/24), which depends on this PRD's Access bypass shipping first.
- **Terraform-managed Cloudflare resources.** Future ergonomics PRD.
- **Auto-rollback on smoke failure.** Waits for a health-check primitive.
