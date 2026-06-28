# ADR-028: Private Tunnels (provider-owned Cloudflare Tunnel provisioning + two-layer health)

![Status](https://img.shields.io/badge/status-Proposed-yellow) ![Date](https://img.shields.io/badge/date-2026--06--27-blue)

## Context

Half of the origins boop schedules against live on private networks with no public IP. CONTEXT.md already names this ("internal services via Cloudflare Tunnel") and `targets.reachability` carries a `tunnel` value, but no surface wires it: every Target is implicitly `public`. The job is a clean, simple way to set up a tunnel, manage it, tell the operator exactly what to do on the on-prem side, and show in the UI whether the tunnel is healthy and operational.

The prior spec for this ([issue #50](https://github.com/mwheatfill/boop/issues/50)) was written against the pre-[ADR-027](027-domain-simplification-workspace-consolidation.md) Customer model (a Customer Settings tab, `customer_secrets`, `customer_tunnels`) and bundled unrelated scope (hot-window retention, Variables/Secrets sections). It also led with a manual copy-paste-the-credentials flow. It is superseded here and rescoped to tunnels only, remapped to Workspace.

Verified against the cloudflare-docs MCP (2026-06-27):

- **Remotely-managed tunnels** are created and configured through the Cloudflare API; the connector is installed with one command, `cloudflared service install <token>` (token from `GET /accounts/:id/cfd_tunnel/:id/token`).
- **Access Service Tokens** are the canonical service-to-service auth: a `self_hosted` Access app with a `non_identity` policy whose `include` is the service token; requests carry `CF-Access-Client-Id` / `CF-Access-Client-Secret`.
- **Connector status** (`Healthy` / `Degraded` / `Down` / `Inactive`) reflects only the connector ↔ Cloudflare edge link. Cloudflare's docs explicitly warn it does not indicate whether the connector can reach the origin: a tunnel can read `Healthy` while the service is unreachable.
- Constraints: outbound **UDP 7844** (QUIC, TCP 7844 fallback) is required; **one `cloudflared` service per host** (reuse a tunnel by adding routes, not a tunnel per Target); HA is additional connectors (replicas) on the same tunnel.

## Decision

Model a **Tunnel** as a first-class Workspace-owned entity that boop provisions, operates, and decommissions through the Cloudflare API. The runtime hot path ([ADR-014](014-two-lane-dispatch.md), `dispatchRun()`) is unchanged except for adding two headers on tunnel-reachable Targets.

| Concern | Choice | Over |
|---|---|---|
| Tunnel as entity | **`Tunnel` is a first-class entity owned by a Workspace** (additive `workspace_id` per ADR-027), referenced by Targets. One Tunnel fronts many Targets (one connector, many routes). Multiple Tunnels per Workspace are the per-site granularity the retired Customer tier used to carry. | An attribute on Target (duplicates credentials and health across Targets sharing a connector; nothing to manage or health-check). |
| Naming | **Entity noun is `Tunnel`** (matches Cloudflare and the existing `reachability = 'tunnel'`); the UI/feature surface is **"Private Tunnels"** so the private-network signifier lives where operators read it. **Connector** = the `cloudflared` process; **Route** = the public hostname mapped to an internal origin. | `private_tunnel` as the schema noun (clunky identifier); `Site` / `Connection` (diverge from the words operators see in Cloudflare). |
| Ownership model | **Model B only (provider-owned).** SwitchThink's single Cloudflare account owns every Tunnel; the customer runs only the install command and never touches Cloudflare. | Model A (customer-owned Cloudflare account, per-Workspace API token): doubles the credential and wizard surface; deferred to a future ADR if an OSS/self-host deployer needs it. |
| Provider credentials | **One provider Cloudflare API token as a Worker secret (`CF_PROVIDER_API_TOKEN`, set via `wrangler secret put`)**, with account ID, DNS zone, and wildcard hostname base as `vars`. Read from `env` in `getProviderConfig`. Not in `workspace_secrets` (instance-level, not per-Workspace user data; and the runtime KEK is not reachable offline to seed one). | Workers Secrets Store binding (deploy chicken-and-egg: a binding to a not-yet-created secret can fail deploy); a reserved `workspace_secrets` row (cannot be seeded without the runtime KEK). |
| Hostnames | **Provider wildcard on a SwitchThink-owned zone** (candidate `*.tunnels.stlabs.org`, exact zone confirmed at implementation). boop issues `<slug>.tunnels.<zone>`; the operator picks a slug, not a zone. | Customer-owned zone (requires the customer to own a CF zone and boop to manage DNS in it; deferred with Model A). |
| Origin auth | **Cloudflare Access Service Token.** A `self_hosted` Access app + `non_identity` policy including the service token; `dispatchRun()` injects `CF-Access-Client-Id` / `CF-Access-Client-Secret` on `reachability = 'tunnel'` Targets, merged under template-rendered headers (operator template wins on key conflict). | Exposing the origin without auth (defeats the tunnel); Workers VPC bindings (see below). |
| Provisioning | **A saga with rollback.** Create tunnel, service token, Access app, policy, DNS record, and hostname route in order; on any step's failure run the inverse operations so no half-provisioned Cloudflare resources are left. One entry point, progress shown per step. | Best-effort sequential calls (orphaned Cloudflare resources on partial failure). |
| Health | **One rolled-up boop status with drill-down**, computed from three signals: (1) Cloudflare connector status, (2) boop's end-to-end verify (HEAD through the hostname with the Access headers), (3) recent Run outcomes against this Tunnel's Targets. | Mirroring Cloudflare connector status alone (the "Healthy but unreachable" trap the docs warn about). |
| Freshness | **Periodic background check on the existing Heartbeat**, no new cron or Durable Object. Poll cheap connector status on a light cadence; run the origin-hitting HEAD on a looser one and skip it when a real Run already exercised the origin in the window. Plus an on-demand Verify button. | A dedicated fixed-interval checker (new infra; re-probes origins Jobs already exercise); verify-only (goes stale between clicks). |
| Lifecycle | **Guarded decommission.** A Tunnel cannot be removed while active Targets reference it (mirrors the [ADR-019](019-soft-delete-policy.md) archive guards). "Remove" runs the Cloudflare teardown in dependency order (service token, policy, app, DNS, tunnel), then archives the row. | Soft-archive only (orphans live Cloudflare resources + a running connector); allowing delete that breaks referencing Jobs at dispatch. |
| Workers VPC | **Rejected, re-confirmed 2026-06-27.** Workers VPC Services have matured (`wrangler vpc service create`), but using one from a Worker still needs a binding declared at deploy time, so it cannot be created per-Target at runtime without redeploying boop. The Access Service Token header pattern stays (zero redeploy per tenant). | Workers VPC bindings (deploy-time, incompatible with operator-created-at-runtime Targets). |

## Consequences

**Positive:**

- The operator path is short: connect once (provider-owned, so usually invisible), name a tunnel and origin, run one install command, and boop auto-binds the Target. The only on-prem action is the single `cloudflared` command.
- Health is honest. boop never shows "operational" from connector status alone; it fuses connector status, an end-to-end probe, and the Run outcomes it already produces, which no external tool has.
- Reuse matches the platform: one connector per host fronts many Targets through added routes, so a customer with twenty internal services installs `cloudflared` once.
- No orphaned cloud state: provisioning and teardown are sagas, and removal is guarded against active dependents.

**Negative:**

- boop takes on a write relationship to a customer-adjacent Cloudflare account. A bug in the provisioning or teardown saga can create or delete real Cloudflare resources. The saga's rollback and the guarded decommission are the mitigations, and both need tests against a stubbed API.
- Model B concentrates trust: one provider API token can manage tunnels, Access apps, and DNS across the zone. It is a least-privilege Worker secret (Tunnel + Access Apps/Policies + Service Tokens + DNS-on-the-zone only), rotatable via `wrangler secret put`, but its blast radius is the provider account.
- The periodic HEAD check sends low-rate traffic to customer origins on a timer (minimized by skipping when Runs already cover the path), which operators should expect.

**Neutral / trade-off:**

- `Tunnel` and `Connector` enter the ubiquitous language; `reachability = 'tunnel'` on Target now means "references a Tunnel." A new `tunnels` table and a `targets.tunnel_id` reference are added; `workspace_id` on `tunnels` is vacuous in v1 (one Workspace) and earns its keep with multi-Workspace, exactly like other entities under ADR-027.
- A hand-rolled typed Cloudflare API client (`src/lib/cloudflare-api/`) is preferred over the official SDK for the handful of endpoints used, consistent with the no-casual-dependencies stance in AGENTS.md. The endpoint set and token scopes are re-verified against the cloudflare-docs MCP at implementation.
- Service-token lifetime/rotation defaults and whether Service Auth consumes Access seats are confirmed at implementation (the docs search did not pin them).
- This supersedes issue #50 (rescoped to tunnels, remapped to Workspace); the settings-tab and hot-window scope it bundled is dropped here and tracked separately if still wanted.
