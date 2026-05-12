# boop

A scheduler that fires HTTP requests on cron or webhook triggers against any reachable endpoint (public internet, or internal services via Cloudflare Tunnel), with AI-native authoring through Microsoft Foundry and alerting fan-out to Teams, PagerDuty, and Autotask.

## Language

**Job**:
A user-created scheduler entry that fires HTTP requests against a target on a defined trigger.
_Avoid_: Schedule, Monitor, Cronjob, Task

**Run**:
One execution of a Job. Has a single start, a single outcome, and one or more Attempts.
_Avoid_: Execution, Invocation, Fire, Tick

**Attempt**:
One HTTP call made by a Run. A Run has multiple Attempts when retries occur.
_Avoid_: Try, Retry, Request

**Trigger**:
The condition that starts a Run. Has one of three types: `cron` (5-field cron expression, ≥ 1-minute granularity), `interval` (`interval_seconds`, supports sub-minute), or `webhook` (no schedule; fired by inbound request). A Job has exactly one Trigger.
_Avoid_: Schedule (the cron string), Source

**Dispatch lane**:
The execution path a Run takes from "due" to "fetch issued." Determined by Trigger type. Cron and Webhook share the **Queue lane**: heartbeat or webhook route → Dispatch Queue → Consumer Worker → `dispatchRun()`. Interval uses the **Alarm lane**: per-Job Durable Object → `alarm()` → `dispatchRun()`. Both lanes call the same shared `dispatchRun()` module.
_Avoid_: Path, Channel

**Heartbeat**:
The single Cron Trigger declared at the Worker level that fires every minute and invokes the evaluator. It is platform infrastructure, not user-facing — operators never see or configure it.
_Avoid_: Pulse, Tick (loose synonyms; "tick" refers to one firing of the heartbeat)

**dispatchRun**:
The shared module both lanes call to perform one fire: D1 CAS claim, render template body/headers, fetch the Target, write Run/Attempt to D1, stream response body to R2, evaluate terminal state, enqueue alert if needed. One implementation, two invokers.
_Avoid_: Executor, Runner

**boop** (verb / brand):
The act of firing. Used in UI copy ("boop fired", "next boop in 4m") but never as a noun in code or schema.

**Customer**:
A real-world organization whose endpoints boop fires against. SwitchThink itself is one Customer; the ~270 client organizations are the rest. Owns Jobs. Maps 1:1 to an Autotask company for alerting/ticketing.
_Avoid_: Tenant, Org, Account, Client (UI may use "client", schema does not)

**Operator**:
A SwitchThink team member who signs into boop. Operators work across Customers — the workspace is one (SwitchThink), not per-Customer.
_Avoid_: User (too generic), Admin

**Target**:
A named, reusable HTTP destination owned by a Customer. Carries URL, method, authentication, and reachability (public or via Cloudflare Tunnel). One Target is referenced by zero or more Jobs.
_Avoid_: Endpoint (collides with API routes), Destination (collides with alert destinations), Hook URL

**Hot window**:
The recency horizon (in days) for which Runs and Attempts live in D1. Older records are archived to R2 and queried through a cold-path interface.
_Avoid_: TTL, Retention period

**Job template**:
A reusable seed for a Job — a saved bundle of cron, target shape, body/headers, and alert routing that an operator instantiates into a real Job. Clone-on-create with no live link: edits to the template do not propagate to existing Jobs.
_Avoid_: Blueprint (implies live link), Preset

**Render context**:
The set of values available to a Job's body and header templates at fire time — includes Run id, Attempt number, Customer name, current time, and operator-defined variables. Resolved by a sandboxed templating engine; no code execution.
_Avoid_: Bindings, Scope

**Outcome**:
The result of a terminal Run. `success` if at least one Attempt returned 2xx. `failure` if all Attempts exhausted without success. `timeout` if the Run's overall deadline was hit. `null` while the Run is still in flight, or when the Run was skipped.
_Avoid_: Result, Status (status is separate — see below)

**Status**:
A Run's lifecycle position, distinct from its **Outcome**. Values: `scheduled` (anticipated but not started), `running` (Attempts in flight), `completed` (terminal — outcome populated), `canceled` (terminal — operator killed it). A skipped fire is `completed` with null outcome and a populated `skipped_reason`.
_Avoid_: State, Phase

**Failure kind**:
On an Attempt, the typed reason for non-success: `timeout`, `network`, `http_4xx`, `http_5xx`, `non_2xx_other`. Drives alert routing and observability.
_Avoid_: Error type, Cause

## Relationships

- A **Job** belongs to exactly one **Customer**
- A **Job** has exactly one **Trigger** (cron or webhook)
- A **Job** references exactly one **Target**; a **Target** is referenced by zero or more **Jobs**
- A **Target** belongs to exactly one **Customer**
- A **Job** produces zero or more **Runs**
- A **Run** has one or more **Attempts** (one per retry)
- A **Run** belongs to exactly one **Job** (and transitively, one **Customer**)
- **Operators** see all **Customers** (role-based filtering is a phase-2 concern)

## Example dialogue

> **Dev:** "When a **Job's** cron fires and the first HTTP call gets a 502, does that create a new **Run**?"
> **Domain expert:** "No, that's the same **Run** — it just has a second **Attempt** after the retry. A new **Run** only starts on the next cron tick."

## Flagged ambiguities

- "Schedule" was overloaded (the noun *and* the cron string) — resolved: the noun is **Job**, the cron string is a property of the Job's **Trigger**.
- Cron-triggered vs webhook-triggered jobs share one noun (**Job**) with a polymorphic **Trigger**, not two separate domain objects.
- "Tenant" / "Org" / "Account" all collapse to **Customer**. SwitchThink is one Customer among ~270; it is not a separate "tenant" level above Customer.

## Storage and tenancy

- **Single D1 database** holds all Jobs, Runs, Attempts across all Customers, scoped by `customer_id`.
- **R2** holds (a) request/response bodies and (b) archived Run/Attempt records older than the Hot window.
- Soft multi-tenancy via `customer_id` foreign keys; no per-Customer database, no abstracted DB accessor — call sites use Drizzle directly with `WHERE customer_id = ?`.
- The 10 GB D1 cap is treated as a real constraint, managed by tuning the Hot window and aggressive R2 archival, not by future portability hedges.

## Open terms (to be resolved)

- Default value of the **Hot window** (likely 30 days) — TBD.
- Templating engine for **Render context** (Liquid, Handlebars, Mustache, …) — TBD.
- Alerting fan-out (who gets alerted, how channels are routed) — TBD.
- AI authoring UX through Foundry — TBD.
- Operator authorization model beyond Cloudflare Access — TBD.
