# ADR-016: Operator authorization (Access JWT, Admin/Operator roles, double-bound AI authz)

![Status](https://img.shields.io/badge/status-Proposed-yellow) ![Date](https://img.shields.io/badge/date-2026--05--11-blue)

## Context

boop is internal to SwitchThink (an MSP), fronted by Cloudflare Access with Entra SSO and Conditional Access as the identity policy engine. [ADR-005](005-auth-provider-abstraction.md) keeps identity reads behind a single `getCurrentUser(request)` abstraction; [ADR-006](006-better-auth-with-entra-default.md) names Better Auth as the default in-tree provider. Three questions remain open: which provider boop actually wires up, what coarse-grained roles exist inside the app, and how tools exposed to AI ([ADR-015](015-ai-authoring-stack.md)) are authorized given prompt-injection risk. Picking poorly here either over-builds RBAC matrices on day one or under-builds the guardrail that keeps the AI from acting beyond the calling Operator.

## Decision

Cloudflare Access is authoritative for identity; the app trusts its JWT. Two roles. AI tool calls are double-bound against the human's role and a separate AI allowlist.

| Concern | Choice | Over |
|---|---|---|
| Authentication source | **Cloudflare Access JWT** (`CF-Access-Jwt-Assertion`). `getCurrentUser(request)` per [ADR-005](005-auth-provider-abstraction.md) reads claims directly. No in-tree session store. | Better Auth on top of Access (per [ADR-006](006-better-auth-with-entra-default.md))  duplicates session state with no security gain for an MSP-internal tool already gated by Conditional Access. |
| User identity binding | Map the Access JWT `email` claim to a `users` row on first sight (auto-provision). Role assigned by an Admin afterward; first user auto-promoted to Admin during bootstrap. | Pre-provisioning users out-of-band; making the Access JWT the only source (loses the ability to store role and preferences). |
| Roles | **Two: `admin`, `operator`** stored on the `users` row. Admins manage Customers, Channels, recipe installs, AI tool catalog allowlist. Operators manage Jobs, view Runs, edit AlertRule overrides on Jobs they can see. | Single role (no privilege boundary on Customer/Channel changes); 3+ roles or RBAC matrix (premature; revisit only when a concrete need surfaces). |
| Per-Customer scoping | **Deferred.** Both roles see all Customers in v1. Add a `user_customers` join table in phase 2 if a real requirement emerges. | Per-Customer scoping on day one (heavy UI/UX work for a hypothetical need). |
| AI tool authorization | **Double-bound.** Every Code Mode and external-MCP tool call runs through one check: `humanRoleAllows(tool, user) && aiAllowlistAllows(tool)`. Either gate failing rejects the call. | Mirror-only ("AI can do what the human can") which fails closed against prompt injection that targets Admins. Bot-only ("AI has its own scope") which decouples from the calling Operator. |
| AI allowlist scope | The allowlist is **action-typed**, not data-scoped. `propose_*` and `narrate_*` tools are allowlisted by default; `delete_*`, `disable_customer`, `rotate_credential` are not. Admins can edit the allowlist; no token in the model context can escalate it. | Per-Customer allowlists (too granular for the surface area we have); blanket "AI can do everything an Admin can" (defeats the guardrail). |
| Authoring session storage | Stored in the global control-plane D1, keyed by user_id + session_id. Retained for audit. | DO storage (would require fanout for audit queries); in-memory only (loses the audit trail). |

`getCurrentUser(request)` returns `{ id, email, role: 'admin' | 'operator' }` or `null`. Route guards and server functions read `role`; tool executors read both `role` and the AI allowlist.

## Consequences

**Positive:**

- Cloudflare Access plus Entra Conditional Access stays the only identity surface. Adding or removing an Operator is done in Entra; boop reflects the change on next sign-in. No password reset flows, no MFA enrollment screens, no email verification.
- The role model is small enough to reason about completely on a whiteboard. New Operators get sensible defaults; new Admins are an explicit promotion.
- AI prompt-injection cannot escalate beyond the calling Operator's existing rights. The allowlist further protects against a compromised model trying to use a tool no human would normally use through chat (e.g. `delete_customer`).
- Audit trail for AI-assisted changes is intrinsic: every `propose_*` returns a draft that must be confirmed in the UI, and the Authoring session is retained.

**Negative:**

- Deviates from [ADR-006](006-better-auth-with-entra-default.md). A future change that makes boop accessible outside the Conditional Access perimeter (e.g. customer-facing portal) needs to revisit this ADR and likely install Better Auth at that point.
- Two-role models become irritating exactly when a third role is needed and the data is already spread across `role` checks. The pressure to add a role should be a signal to do it properly (refactor reads through a single authz helper) rather than gradually accumulate sentinel checks.
- The double-bound AI authz check is one extra synchronous check per tool call. Negligible in cost; needs to be enforced consistently or it stops being a guarantee.

**Neutral / trade-off:**

- Auto-provision-on-first-sight means a user who appears in Entra but has no Cloudflare Access policy assignment cannot reach boop at all (Access blocks first). Anyone who does reach boop is by definition allowed in; the only question is the role, which boop assigns.
- Bootstrap promotes the first user to Admin. That is a one-time concern; subsequent Admins are promoted by existing Admins through the UI.
- The AI allowlist is stored alongside other global config in D1 and edited through an Admin-only screen, not through the Tool catalog itself. This is deliberate: the model cannot ask to be granted new permissions.
