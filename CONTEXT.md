# boop

A scheduler that fires HTTP requests on a schedule or webhook trigger against any reachable endpoint (public internet, or internal services via Cloudflare Tunnel), with AI-native authoring through Microsoft Foundry and alerting fan-out to Teams, PagerDuty, and Autotask.

## Language

**Job**:
A user-created scheduler entry that fires HTTP requests against a target on a defined trigger.
_Avoid_: Monitor, Cronjob, Task (and Schedule as a synonym for the entry, see **Schedule**, which is the entry's timing, not the entry)

**Run**:
One execution of a Job. Has a single start, a single outcome, and one or more Attempts. The verb form ("run") is also the UI's word for the manual-fire action, the button reads "Run now", history reads "Last run 4m ago".
_Avoid_: Execution, Invocation, Fire, Tick

**Attempt**:
One HTTP call made by a Run. A Run has multiple Attempts when retries occur.
_Avoid_: Try, Retry, Request

**Trigger**:
The condition that starts a Run. Has one of two user-facing kinds: `schedule` (time-based; see **Schedule**) or `webhook` (no schedule; fired by inbound request). A Job has exactly one Trigger.
_Avoid_: Source

**Schedule**:
The time-based Trigger configuration. The operator expresses a cadence as a preset, an interval, an advanced cron expression, or natural language ("every weekday at 9am ET"), and boop resolves it to a stored representation: a 5-field cron expression (calendar cadences, ≥ 1-minute granularity) or `interval_seconds` (simple every-N, supports sub-minute). The operator never picks cron-vs-interval or a dispatch lane; boop derives both. A natural-language Schedule is proposed as a Draft (via the Tool catalog) and previewed with its next fire times before confirm.
_Avoid_: Cron (the cron string is one serialized form of a Schedule, not the concept), Cadence, Recurrence

**Dispatch lane**:
The execution path a Run takes from "due" to "fetch issued." Derived from the resolved Schedule. A cron-resolved schedule and a Webhook share the **Queue lane**: heartbeat or webhook route → Dispatch Queue → Consumer Worker → `dispatchRun()`. An interval-resolved schedule uses the **Alarm lane**: per-Job Durable Object → `alarm()` → `dispatchRun()`. Both lanes call the same shared `dispatchRun()` module.
_Avoid_: Path, Channel

**Heartbeat**:
The single Cron Trigger declared at the Worker level that fires every minute and invokes the evaluator. It is platform infrastructure, not user-facing, operators never see or configure it.
_Avoid_: Pulse, Tick (loose synonyms; "tick" refers to one firing of the heartbeat)

**dispatchRun**:
The shared module both lanes call to perform one fire: D1 CAS claim, render template body/headers, fetch the Target, write Run/Attempt to D1, stream response body to R2, evaluate terminal state, enqueue alert if needed. One implementation, two invokers.
_Avoid_: Executor, Runner

**Channel**:
A reusable outbound destination for alerts, belonging to exactly one **Workspace**. Discriminated by `kind`: `teams` (webhook URL), `pagerduty` (routing key), `autotask` (company id mapping), `email` (recipient list with subject and body templates), `webhook` (generic HTTP POST). Channel adapters are out-of-process integrations called by the alerting Queue consumer; email goes through the `email/send-pipeline` recipe rather than directly.
_Avoid_: Notifier, Destination (collides with Target), Endpoint

**AlertRule**:
A predicate that decides whether a terminal Run produces an alert, and which Channels fan it out. Attaches at two levels with **additive** semantics: a Run is evaluated against every matching Workspace rule and every matching Job-scoped rule for the Run's Job; the union of all matching rules' Channels is the fan-out set (deduped). No suppression / muting in v1, opting out of a Workspace rule requires deleting it. Built-in rule kinds for v1: `first_failure`, `consecutive_failures` (with N), `recovery` (first success after a failure streak), `slow_run` (duration > threshold), `missed_schedule`. Custom rule DSL deferred.
_Avoid_: Notification policy, Trigger (already taken), Routing

**Authoring session**:
A persisted chat thread where an Operator collaborates with the AI authoring assistant to draft a Job. Survives Operator browser refreshes, retained for audit. The assistant cannot mutate state directly; it composes calls to the Tool catalog, returning a Draft for Operator confirmation. Many concurrent sessions per Operator; optionally Workspace-scoped (when opened inside a Workspace, the AI's read tools default-filter to that Workspace).
_Avoid_: Conversation (too generic), Thread (collides with web tech)

**Draft**:
The typed output of a `propose_*` Tool catalog call inside an Authoring session, a proposed Job, Schedule, Job template, or other state-changing artifact that has not been persisted as a real row. Drafts live in the session's message history (one tool-call result per message) and carry one of three statuses: pending (default), confirmed (Operator clicked Confirm and the corresponding real row was created), discarded (Operator dismissed without creating). The Operator confirmation gate is the only path from Draft to real row, the model cannot persist directly. Per [ADR-015](docs/adr/015-ai-authoring-stack.md).
_Avoid_: Proposal (used as a verb in the tool name `propose_*` but the noun is Draft), Suggestion (too soft, Drafts are typed, validated, ready-to-confirm)

**Tool catalog**:
The typed set of boop functions exposed to AI: `list_workspaces`, `list_targets`, `list_jobs`, `propose_job`, `propose_schedule`, `propose_template`, `narrate_run_history`, `summarize_failures`, and similar. Same catalog is consumed by two surfaces: (a) the in-app authoring assistant via the Code Mode SDK, and (b) external agents via boop's MCP server. One source of truth, two surfaces. Each tool call is **double-bound**: the calling Operator's role is the ceiling (AI can never exceed what the human could do directly) and a separate AI allowlist is the floor (some actions are forbidden to AI regardless of role).
_Avoid_: Functions, Capabilities

**Runbook narration**:
A summarization view that turns recent Run/Attempt history into a short prose status report. Runs on a daily cron ("morning briefing") and on-demand via a button in the Job detail view. Read-only, does not propose changes.
_Avoid_: Report, Digest

**boop** (brand):
The product name. Brand-only, not used as a verb or noun in UI copy, code, or schema. The UI verb for one execution is "run" (see **Run**).

**Workspace**:
The single organizational tier, and in v1, the single Workspace. One default Workspace is seeded and every surface resolves to it (server-side, in the `_authenticated` route context); there is no switcher and no `/workspaces/$slug` in any URL. A Workspace owns Targets, Jobs, Channels, and AlertRules, and may carry an optional Autotask company association (metadata, not structure). Multiple Workspaces (one per isolated client) are deferred until the tier scopes visibility, permissions, or routing; the schema keeps `workspace_id` on every entity so it returns additively (see [ADR-027](docs/adr/027-domain-simplification-workspace-consolidation.md)).
_Avoid_: Customer, Tenant, Org, Account, Client (the term is Workspace in UI, code, and schema)

**Operator**:
A team member who signs into boop. Operators work within the single Workspace. Authentication is via Cloudflare Access (Entra SSO + Conditional Access). Each Operator has one of two roles: **Admin** (manages Channels and global config) or the default Operator (manages Targets, Jobs, views Runs). Per-Workspace scoping of Operators returns with multi-Workspace.
_Avoid_: User (too generic)

**Admin**:
An Operator with elevated role. Can manage Channels and global configuration; can install/remove recipes; can modify the AI Tool catalog allowlist. (Workspace lifecycle management is deferred with multi-Workspace.) All other Operators are restricted to Target-, Job-, and Run-level work.
_Avoid_: Owner, Superuser

**Target**:
A named, reusable HTTP destination owned by a Workspace. Carries URL, method, authentication, and reachability (`public`, or `tunnel` referencing a **Tunnel**). One Target is referenced by zero or more Jobs. Targets are picked-or-created inline from the Job form and render inline on the Job; Operators may create them.
_Avoid_: Endpoint (collides with API routes), Destination (collides with alert destinations), Hook URL

**Tunnel**:
A Workspace-owned Cloudflare Tunnel that lets boop reach a private-network origin without exposing it to the public internet. boop provisions, operates, and decommissions it through the Cloudflare API (Model B: SwitchThink's Cloudflare account owns every Tunnel; the customer runs only the Connector install command, never touching Cloudflare). A Target with `reachability = 'tunnel'` references one Tunnel; one Tunnel fronts zero or more Targets (one connector, many routes). Health is a single rolled-up status over three signals: Cloudflare connector status, boop's end-to-end verify, and recent Run outcomes for the Tunnel's Targets. UI surface: "Private Tunnels". Per [ADR-028](docs/adr/028-private-tunnels.md).
_Avoid_: Customer site, VPN, Proxy

**Connector**:
The `cloudflared` process the customer runs on a host inside their private network; it makes the outbound-only connection to Cloudflare that a Tunnel rides. One Connector per host (reuse a Tunnel by adding routes, not a Connector per Target); additional Connectors on other hosts are replicas for high availability. Its status (`Healthy`, `Degraded`, `Down`, `Inactive`) is the first of a Tunnel's three health signals and reflects only the Connector-to-Cloudflare link, not whether the origin is reachable.
_Avoid_: Agent, Daemon, Tunnel (a Connector runs a Tunnel; they are not the same)

**Hot window**:
The recency horizon for which Runs and Attempts live in D1. Default is 30 days. Older records are archived to R2 and queried through a cold-path interface. Per-Workspace override is supported when a Workspace requires longer hot retention.
_Avoid_: TTL, Retention period

**Job template**:
A reusable seed for a Job, a saved bundle of Schedule, target shape, body/headers, and alert routing that an operator instantiates into a real Job. Clone-on-create with no live link: edits to the template do not propagate to existing Jobs.
_Avoid_: Blueprint (implies live link), Preset

**Render context**:
The set of values available to a Job's body and header templates at fire time. Includes Run id, Attempt number, Workspace name, current time, and operator-defined variables. Resolved by **LiquidJS** (sandboxed by design, no code execution). Custom Liquid filters and tags are added in-tree for boop-specific helpers like `{{ now | iso_date }}` and `{% boop_secret "vault-key" %}`.
_Avoid_: Bindings, Scope

**Outcome**:
The result of a terminal Run. `success` if at least one Attempt returned 2xx. `failure` if all Attempts exhausted without success. `timeout` if the Run's overall deadline was hit. `null` while the Run is still in flight, or when the Run was skipped.
_Avoid_: Result, Status (status is separate, see below)

**Status**:
A Run's lifecycle position, distinct from its **Outcome**. Values: `scheduled` (anticipated but not started), `running` (Attempts in flight), `completed` (terminal, outcome populated), `canceled` (terminal, operator killed it). A skipped fire is `completed` with null outcome and a populated `skipped_reason`.
_Avoid_: State, Phase

**Failure kind**:
On an Attempt, the typed reason for non-success: `timeout`, `network`, `http_4xx`, `http_5xx`, `non_2xx_other`. Drives alert routing and observability.
_Avoid_: Error type, Cause

## Relationships

- A **Job** belongs to exactly one **Workspace**
- A **Job** has exactly one **Trigger** (schedule or webhook)
- A **Job** references exactly one **Target**; a **Target** is referenced by zero or more **Jobs**
- A **Target** belongs to exactly one **Workspace**
- A **Target** with `reachability = 'tunnel'` references exactly one **Tunnel**; a **Tunnel** fronts zero or more **Targets**
- A **Tunnel** belongs to exactly one **Workspace** (additive `workspace_id`; multiple Tunnels per Workspace, one per private network or site)
- A **Tunnel** is served by one or more **Connectors** (additional Connectors are replicas for high availability)
- A **Job** produces zero or more **Runs**
- A **Run** has one or more **Attempts** (one per retry)
- A **Run** belongs to exactly one **Job** (and transitively, one **Workspace**)
- **Operators** work in the single **Workspace** (multi-Workspace and per-Workspace scoping are deferred)
- A **Workspace** has zero or more **Channels** and zero or more Workspace-scoped **AlertRules**
- A **Job** has zero or more Job-scoped **AlertRules** (added to the Workspace set when evaluating Runs of that Job)
- An **AlertRule** references one or more **Channels** of its own **Workspace**
- An **Operator** has zero or more **Authoring sessions**; each session can produce zero or more Drafts that the Operator confirms into real Jobs
- The **Tool catalog** is referenced by both the in-app authoring assistant (via Code Mode) and the external MCP server (via the `search_and_execute` portal pattern)

## Example dialogue

> **Dev:** "When a **Job's** schedule fires and the first HTTP call gets a 502, does that create a new **Run**?"
> **Domain expert:** "No, that's the same **Run**, it just has a second **Attempt** after the retry. A new **Run** only starts on the next scheduled fire."

## Flagged ambiguities

- "Schedule" was once overloaded (the entry *and* the cron string). Resolved: the entry is a **Job**; the time-based Trigger configuration is a **Schedule** (which boop resolves to a cron expression or an interval); the cron string is one serialized form of a Schedule.
- Cron, interval, and webhook are not three domain objects. A **Job** has one **Trigger** whose kind is `schedule` (resolving internally to cron or interval) or `webhook`.
- "Customer" / "Tenant" / "Org" / "Account" / "Client" all collapse to **Workspace**. There is no tier above Workspace; per-client isolation, when needed, is modeled as separate Workspaces.

## Storage and tenancy

- **Single D1 database** holds all Jobs, Runs, Attempts across all Workspaces, scoped by `workspace_id`.
- **R2** holds (a) request/response bodies and (b) archived Run/Attempt records older than the Hot window.
- Soft multi-tenancy via `workspace_id` foreign keys; no per-Workspace database, no abstracted DB accessor, call sites use Drizzle directly with `WHERE workspace_id = ?`.
- The 10 GB D1 cap is treated as a real constraint, managed by tuning the Hot window and aggressive R2 archival, not by future portability hedges.

## Open terms (deferred to implementation or follow-up)

- Channel-adapter implementation details (Teams card shape, PagerDuty Events API v2 payload, Autotask REST mapping, email subject/body defaults), deferred to implementation phase.
- Cross-Workspace shared destinations (one Channel referenced by every Workspace), out of v1; re-create per Workspace, or a future shared tier behind a new ADR.
- Template-level question: should MCP server + Code Mode be baked into the template (superseding ADR-012's recipe-only stance)? Out of scope for boop; flagged for the recipes team conversation.
- Per-Workspace Operator scoping (phase 2; today Admins and Operators see all Workspaces).
