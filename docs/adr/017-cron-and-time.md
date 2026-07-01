# ADR-017: Cron parser, date/time approach, and timezone on the data model

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--11-blue)

## Context

boop fires Jobs on cron, interval, and webhook Triggers. The dispatch design ([ADR-014](014-two-lane-dispatch.md)) is settled, but evaluating "is this cron Job due now?" requires three things the codebase has not chosen:

1. A **cron expression parser** that takes a 5-field cron string plus a reference instant and returns the next fire time. CONTEXT.md fixes the syntax (5-field, 1-minute granularity), not the library.
2. A **date / timezone approach** for the dispatch hot path and the UI. The Workers runtime (workerd) embeds ICU, but no date library is in `package.json` and `Temporal` availability in workerd is undocumented.
3. A **timezone on the data model**. SwitchThink runs Jobs against Customer endpoints across multiple time zones; a cron like `"0 9 * * MON-FRI"` is ambiguous without a tz anchor. CONTEXT.md does not name where tz lives.

Picking poorly here either bloats the Workers bundle (Workers caps compressed bundles at 1 MB, per [ADR-004](004-drizzle-orm.md)), forces every UI screen to import a date library it doesn't need, or makes operators write UTC cron expressions by hand.

## Decision

| Concern | Choice | Over |
|---|---|---|
| Cron expression parser | **[`croner`](https://github.com/hexagon/croner)** — zero deps, TS-first, advertises Node / Deno / Bun / Browser support (same V8 surface as workerd), built-in `timezone` option. We use only the parsing half (`new Cron(expr, { timezone }).nextRun(from)`); the dispatch lanes own scheduling per ADR-014. | `cron-parser` (pulls Luxon as a transitive dep for DST math, doubles the dependency footprint); `node-cron` (scheduler, not parser). |
| Date / timezone in app code | **Native `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat`, plus epoch-ms integers from D1.** Drizzle's `integer({ mode: 'timestamp_ms' })` returns `Date` objects; comparisons and arithmetic on epoch-ms cover the dispatch hot path. Display formatting in a Customer's tz uses `Intl.DateTimeFormat({ timeZone })`. | Adding a date library on day one (`date-fns`, `luxon`, `@date-fns/tz`) when the cron tz problem is owned by croner and the UI's needs (format-in-tz, relative-time) are first-class in `Intl.*`. Temporal (still experimental in workerd; ergonomic win is small for v1). |
| Timezone on `customers` | **`customers.timezone TEXT NOT NULL`** holding an IANA zone string (e.g. `'America/New_York'`). Default tz for that Customer's Jobs' Triggers. | A workspace-level default (SwitchThink spans Customer time zones); a per-Job-required field (verbose for the common case where every Job in a Customer shares one tz). |
| Per-Job tz override | **`jobs.trigger_timezone TEXT`** nullable. `NULL` means inherit from `customers.timezone`. Lets one Customer have most Jobs in their local tz plus one cross-region health check anchored to UTC. | Forcing every Job to repeat the Customer tz (boilerplate); making per-Job tz mandatory (no escape hatch). |
| Tz on interval and webhook Triggers | **None.** `interval_seconds` is timezone-independent; webhook fires on receipt. | Storing tz on every Trigger uniformly (unused fields invite drift). |
| Effective tz resolution | At evaluation time: `effective_tz = jobs.trigger_timezone ?? customers.timezone`, then `new Cron(jobs.cron_expression, { timezone: effective_tz }).nextRun(jobs.last_fire_at)`. | Pre-computing `next_fire_at` on write (DST transitions and cron edits would silently desync). |

The heartbeat evaluator (ADR-014) reads `(jobs.cron_expression, effective_tz, jobs.last_fire_at)`, computes `nextRun` via croner, and enqueues if `nextRun <= now()`. The result is not persisted; the next evaluator tick recomputes it.

`croner` is added as a `pnpm add` proposal (deny-by-default per AGENTS.md). No date library is added.

## Consequences

**Positive:**

- One dependency for the entire cron concern. Zero deps in `croner` means no transitive surprises in the Workers bundle.
- The UI does not pay for a date library it does not need. `Intl.DateTimeFormat` covers "format this instant in this tz" with zero install.
- Tz is a first-class column on `customers`, so the dashboard's "Jobs for this Customer" view shows times in the right tz without per-Job configuration.
- The per-Job override exists for the cases that need it (cross-region health checks, UTC-anchored batch windows) without making the common case verbose.
- Effective tz is computed at evaluation time, so editing `customers.timezone` immediately re-anchors every inheriting Job's next fire calculation, with no migration step.

**Negative:**

- Native `Intl` in workerd: documentation did not surface explicit confirmation, so a throwaway probe Worker was run against `wrangler dev --local` on 2026-05-11 (compat date `2026-04-17`, wrangler `4.82.2`). Result: `new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York' })` formats correctly and `resolvedOptions().timeZone` round-trips; `Intl.supportedValuesOf('timeZone')` returns 418 zones; bogus zones (`'NYC'`) throw `RangeError`. One ICU quirk: aliases like `Asia/Kolkata` are not in `supportedValuesOf` (canonicalized to `Asia/Calcutta`) but are still accepted by `DateTimeFormat`, so the fallback try/catch path in `tzSchema` is load-bearing for those.
- "No date library yet" is a posture, not a permanent ban. If a downstream PRD shows a real need for date math beyond `Date` and `Intl`, that's the trigger to add `@date-fns/tz` (preferred over Luxon for bundle reasons, preferred over Temporal for workerd-compat reasons in 2026).
- Two columns (`customers.timezone` and `jobs.trigger_timezone`) instead of one. The resolution rule (`override ?? default`) must be applied consistently; encapsulating it in a single helper (`effectiveTimezone(job)`) is the suggested mitigation.

**Neutral / trade-off:**

- `croner` supports a 6-field syntax (with seconds). CONTEXT.md fixes boop's cron to 5 fields. We rely on operator input validation (a Zod refinement on the `cron_expression` field) to reject 6-field expressions, not on croner refusing to parse them.
- `Intl.RelativeTimeFormat` produces formatted strings like `"in 4 minutes"`. UI copy ("next boop in 4m") may want shorter forms; a thin local formatter that consumes epoch-ms and emits boop-flavored strings ("4m", "2h ago") is the expected wrapper. Trivial to write; cheaper than a date library.
- The `effective_tz` resolution depends on a join (`jobs` LEFT JOIN `customers`). The heartbeat scan already needs Customer-level state (per ADR-014), so this is not a new query.
