# boop

A scheduler that fires HTTP requests on cron or webhook triggers against any reachable endpoint (public internet, or internal services via Cloudflare Tunnel), with AI-native authoring through Microsoft Foundry and alerting fan-out to Teams, PagerDuty, and Autotask.

## Language

**Job**:
A user-created scheduler entry that fires HTTP requests against a target on a defined trigger.
_Avoid_: Schedule, Monitor, Cronjob, Task

**Run**:
One execution of a Job. Has a single start, a single outcome, and one or more Attempts. The verb form ("run") is also the UI's word for the manual-fire action — the button reads "Run now", history reads "Last run 4m ago".
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

**Channel**:
A reusable outbound destination for alerts. Scope is **workspace** (visible to every Customer's AlertRules) or **customer** (private to the owning Customer). Discriminated by `kind`: `teams` (webhook URL), `pagerduty` (routing key), `autotask` (company id mapping), `email` (recipient list with subject and body templates), `webhook` (generic HTTP POST). Channel adapters are out-of-process integrations called by the alerting Queue consumer; email goes through the `email/send-pipeline` recipe rather than directly.
_Avoid_: Notifier, Destination (collides with Target), Endpoint

**AlertRule**:
A predicate that decides whether a terminal Run produces an alert, and which Channels fan it out. Attaches at three levels with **additive** semantics: a Run is evaluated against every matching workspace rule, every matching Customer-scoped rule for the Run's Customer, and every matching Job-scoped rule for the Run's Job; the union of all matching rules' Channels is the fan-out set (deduped). No suppression / muting in v1 — opting a Customer out of a workspace rule requires deleting it. Built-in rule kinds for v1: `first_failure`, `consecutive_failures` (with N), `recovery` (first success after a failure streak), `slow_run` (duration > threshold). Custom rule DSL deferred.
_Avoid_: Notification policy, Trigger (already taken), Routing

**Authoring session**:
A persisted chat thread where an Operator collaborates with the AI authoring assistant to draft a Job. Survives Operator browser refreshes, retained for audit. The assistant cannot mutate state directly; it composes calls to the Tool catalog, returning a Draft for Operator confirmation. Many concurrent sessions per Operator; optionally Customer-scoped (when opened from a Customer hub, the AI's read tools default-filter to that Customer).
_Avoid_: Conversation (too generic), Thread (collides with web tech)

**Draft**:
The typed output of a `propose_*` Tool catalog call inside an Authoring session — a proposed Job, Job template, or other state-changing artifact that has not been persisted as a real row. Drafts live in the session's message history (one tool-call result per message) and carry one of three statuses: pending (default), confirmed (Operator clicked Confirm and the corresponding real row was created), discarded (Operator dismissed without creating). The Operator confirmation gate is the only path from Draft to real row — the model cannot persist directly. Per [ADR-015](docs/adr/015-ai-authoring-stack.md).
_Avoid_: Proposal (used as a verb in the tool name `propose_*` but the noun is Draft), Suggestion (too soft — Drafts are typed, validated, ready-to-confirm)

**Tool catalog**:
The typed set of boop functions exposed to AI: `list_customers`, `list_targets`, `list_jobs`, `propose_job`, `propose_template`, `narrate_run_history`, `summarize_failures`, and similar. Same catalog is consumed by two surfaces: (a) the in-app authoring assistant via the Code Mode SDK, and (b) external agents via boop's MCP server. One source of truth, two surfaces. Each tool call is **double-bound**: the calling Operator's role is the ceiling (AI can never exceed what the human could do directly) and a separate AI allowlist is the floor (some actions are forbidden to AI regardless of role).
_Avoid_: Functions, Capabilities

**Runbook narration**:
A summarization view that turns recent Run/Attempt history into a short prose status report. Runs on a daily cron ("morning briefing") and on-demand via a button in the Job detail view. Read-only — does not propose changes.
_Avoid_: Report, Digest

**boop** (brand):
The product name. Brand-only — not used as a verb or noun in UI copy, code, or schema. The UI verb for one execution is "run" (see **Run**).

**Customer**:
A real-world organization whose endpoints boop fires against. SwitchThink itself is one Customer; the ~270 client organizations are the rest. Owns Jobs. Maps 1:1 to an Autotask company for alerting/ticketing.
_Avoid_: Tenant, Org, Account, Client (UI may use "client", schema does not)

**Operator**:
A SwitchThink team member who signs into boop. Operators work across Customers, the workspace is one (SwitchThink), not per-Customer. Authentication is via Cloudflare Access (Entra SSO + Conditional Access). Each Operator has one of two roles: **Admin** (manages Customers, Channels, global config) or the default Operator (manages Jobs, views Runs). Per-Customer scoping of Operators is a phase-2 concern.
_Avoid_: User (too generic)

**Admin**:
An Operator with elevated role. Can create/edit Customers, Channels, and global configuration; can install/remove recipes; can modify the AI Tool catalog allowlist. All other Operators are restricted to Job-level and Run-level work within Customers they can see.
_Avoid_: Owner, Superuser

**Target**:
A named, reusable HTTP destination owned by a Customer. Carries URL, method, authentication, and reachability (public or via Cloudflare Tunnel). One Target is referenced by zero or more Jobs.
_Avoid_: Endpoint (collides with API routes), Destination (collides with alert destinations), Hook URL

**Hot window**:
The recency horizon for which Runs and Attempts live in D1. Default is 30 days. Older records are archived to R2 and queried through a cold-path interface. Per-Customer override is supported when a Customer requires longer hot retention.
_Avoid_: TTL, Retention period

**Job template**:
A reusable seed for a Job — a saved bundle of cron, target shape, body/headers, and alert routing that an operator instantiates into a real Job. Clone-on-create with no live link: edits to the template do not propagate to existing Jobs.
_Avoid_: Blueprint (implies live link), Preset

**Render context**:
The set of values available to a Job's body and header templates at fire time. Includes Run id, Attempt number, Customer name, current time, and operator-defined variables. Resolved by **LiquidJS** (sandboxed by design, no code execution). Custom Liquid filters and tags are added in-tree for boop-specific helpers like `{{ now | iso_date }}` and `{% boop_secret "vault-key" %}`.
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
- The **workspace** has zero or more workspace-scoped **Channels** and zero or more workspace-scoped **AlertRules** (defaults inherited by every Customer)
- A **Customer** has zero or more Customer-scoped **Channels** and zero or more Customer-scoped **AlertRules** (added to the workspace set when evaluating any Job in the Customer)
- A **Job** has zero or more Job-scoped **AlertRules** (added to the Customer + workspace sets when evaluating Runs of that Job)
- An **AlertRule** references one or more **Channels** to fan out to; a Customer-scoped AlertRule may reference workspace Channels and Channels of its own Customer; a workspace AlertRule references workspace Channels only
- An **Operator** has zero or more **Authoring sessions**; each session can produce zero or more drafts that the Operator confirms into real Jobs
- The **Tool catalog** is referenced by both the in-app authoring assistant (via Code Mode) and the external MCP server (via the `search_and_execute` portal pattern)

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

## Open terms (deferred to implementation or follow-up)

- Channel-adapter implementation details (Teams card shape, PagerDuty Events API v2 payload, Autotask REST mapping, email subject/body defaults) — deferred to implementation phase.
- Template-level question: should MCP server + Code Mode be baked into the template (superseding ADR-012's recipe-only stance)? Out of scope for boop; flagged for the recipes team conversation.
- Per-Customer Operator scoping (phase 2; today Admins and Operators see all Customers).
