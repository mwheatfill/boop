# seed:demo

Populates a local D1 database with a fictional Arizona-MSP-credible dataset so the dashboard, palette, Customer hub, and Job detail surfaces have something to render. Every demo row carries `seed_tag = 'demo-v1'`; cleanup deletes only those rows.

## Quickstart

```bash
pnpm db:migrate:local          # apply migrations to the local D1
pnpm seed:demo                 # default = --profile=demo
```

## Profiles

| Flag | Window | Customers | Jobs | Approx Run rows | Use |
|---|---|---|---|---|---|
| `--profile=demo` (default) | 14 days | 9 | 41 | ~200K | normal onboarding / UI iteration |
| `--profile=stress` | 90 days | 9 | 41 | ~1.3M | D1 / dispatcher / palette stress |
| `--profile=minimal` | 3 days | 1 | 5 | ~10K | CI integration tests, quick iteration |

## Commands

```bash
pnpm seed:demo                              # idempotent upsert (default profile)
pnpm seed:demo --profile=stress             # 90 days of history
pnpm seed:demo --profile=minimal            # smallest viable set
pnpm seed:demo --reset                      # delete all demo rows, then insert fresh
pnpm seed:demo --reset --profile=stress --confirm   # required for stress cleanup
```

## Pushing the seeded data to remote D1

`pnpm seed:remote` exports the locally-seeded data and imports it into a remote D1 binding via `wrangler d1 export` + `wrangler d1 execute --remote --file`, split by table in FK-dependency order.

```bash
pnpm db:migrate:prod                  # ensure remote has the latest migrations
pnpm seed:demo                        # populate local D1 first
pnpm seed:remote                      # push to the top-level (dev) D1 binding
pnpm seed:remote --env=production     # push to env.production's D1 binding
pnpm seed:remote --reset              # delete every seed_tag = demo-v1 row on remote first
```

Caveats: `wrangler d1 export --local` includes *every* row in your local D1, not just demo rows. If you have unrelated local data, it gets pushed too. `--reset` only clears demo rows on remote, not whatever you're about to push. The wrapper splits the dump by table and imports in FK order because `wrangler d1 export` emits inserts alphabetically (so `alert_rules` lands before `customers`, and a one-shot import fails on FK constraints).

## Properties

- **Idempotent.** IDs are derived from a stable hash of `boop:demo:<kind>:<segments>`; re-runs upsert by id. Run history insertions use `ON CONFLICT (id) DO NOTHING`, so repeat passes are no-ops.
- **Cleanup is scoped.** `--reset` deletes only rows where `seed_tag = 'demo-v1'` (or rows owned by those Customers/Operators). Operator-created rows with `seed_tag IS NULL` are never touched.
- **Production-locked.** Refuses to run when `NODE_ENV=production`.
- **Headless.** Talks directly to the local D1 sqlite file under `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`; no Wrangler shelling out per insert.

## What gets seeded

- **9 Customers** — Desert Vista Credit Union, Cactus Title, Sun Valley Insurance, Phoenix Healthcare Partners, Mesa Manufacturing Co., Salt River Logistics, Tempe Tech Group, Skyline Realty Trust, SwitchThink (internal). Mostly `America/Phoenix`; Salt River Logistics is `America/Los_Angeles`.
- **6 Operators** — Michael Wheatfill + Braden Chapman (Admin), Jason Smith + Dylan McNeill + Travis Wilbeck + Joleen Riley (Operator). Emails are `<first>.<last>@switchthink.com`; Michael Wheatfill's email matches the `DEV_USER_EMAIL` default so dev-bypass resolves to a real demo Operator row.
- **25 Targets** — credible URLs across `public` and `tunnel` reachabilities, mixed GET/POST/PUT, mixed auth kinds.
- **41 Jobs** across nine categories — health checks (interval, 30-60s), data sync (cron), reconciliation (cron hourly), reports (cron daily/weekly/monthly), cleanup, cache warming, token refresh, workflow ticks, webhook receivers.
- **17 Channels** — Teams primary, email and webhook (used for PagerDuty/Autotask bridges) on critical Customers. Note: native `pagerduty` and `autotask` channel kinds are accepted by the DB schema but have no adapter, so the seed wires those integrations through the `webhook` channel kind.
- **15 AlertRules** — covering all four kinds: `first_failure`, `consecutive_failures`, `recovery`, `slow_run`.
- **Run history** — distributed across five patterns: steady-healthy (~80%), recent-outage (~10%), actively-failing (~5%), high-variance (~3%), paused (~2%). Per-Job latency profile, occasional 5× spikes, retries with realistic `failure_kind` values.
- **Recent alert signals** — `alertRules.lastFiredAt` and `channels.lastUsedAt` / `lastTestAlertAt` are stamped to make the alerts surface look alive. Alerts are not persisted as events (PR #55 ships alerts via queue + adapters, not a table), so this is the closest analog.

## What gets skipped

If PRD #48 (`customer_secrets`) or PRD #50 (`customer_tunnels`) tables are not yet present, the corresponding seed modules are absent here and will land in follow-up PRDs.

## Operator data is never touched

`--reset` walks dependencies in FK order (attempts → runs → jobs → targets → customers; users last) using `WHERE seed_tag = 'demo-v1'` at the roots and inheriting via `customer_id IN (<demo customer ids>)` at the children. Real Customer / Operator rows (where `seed_tag IS NULL`) are invisible to the cleanup query.
