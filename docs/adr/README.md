# Architecture Decision Records

These ADRs capture the rationale behind the major platform, framework, and library choices in this template. Read one when you're asking "why was X chosen?" or contemplating an override.

Each ADR has three sections: Context, Decision, Consequences. Status and date are pills at the top of the file. See [`000-template.md`](000-template.md) for the canonical shape; [`008-ui-visual-layer.md`](008-ui-visual-layer.md) is the marquee example.

## Index

Ordered foundation → data → auth → AI → product surface → meta.

| ADR | Status | Topic |
|---|---|---|
| [000](000-template.md) | Reference | ADR template (copy this for new ADRs) |
| [001](001-cloudflare-workers-runtime.md) | Accepted | Cloudflare Workers as the runtime |
| [002](002-tanstack-start-framework.md) | Accepted | TanStack Start as the framework |
| [003](003-d1-default-data-layer.md) | Accepted | Cloudflare D1 default; Neon Postgres via recipe |
| [004](004-drizzle-orm.md) | Accepted | Drizzle as the ORM |
| [005](005-auth-provider-abstraction.md) | Accepted | Auth provider abstraction (`getCurrentUser`) |
| [006](006-better-auth-with-entra-default.md) | Accepted | Better Auth + Entra OIDC default; Cloudflare Access via recipe |
| [007](007-foundry-via-ai-gateway.md) | Accepted | Microsoft Foundry via Cloudflare AI Gateway |
| [008](008-ui-visual-layer.md) | Accepted | UI / visual layer (shadcn-base-vega centered; charts, toasts, icons, motion, theme, dashboard) |
| [009](009-opinionated-stack-and-pattern-enforcement.md) | Accepted | Opinionated stack with mechanical pattern enforcement |
| [010](010-neutral-agent-governance.md) | Accepted | Neutral agent governance (one canonical AGENTS.md + per-harness adapters) |
| [011](011-skill-currency-protocol.md) | Accepted | Skill currency protocol (Intent + MCP servers) |
| [012](012-discoverability-in-template.md) | Accepted | Discoverability surface in the template |
| [013](013-forms-and-validation.md) | Accepted | Forms + validation (TanStack Form, React 19 actions, Zod) |
| [014](014-two-lane-dispatch.md) | Proposed | Two-lane dispatch (heartbeat scan for cron/webhook, per-Job DO alarm for interval) |
| [015](015-ai-authoring-stack.md) | Proposed | AI authoring stack (Vercel AI SDK, Cloudflare Agents, Code Mode, MCP server) |
| [016](016-operator-authz.md) | Proposed | Operator authorization (Access JWT, Admin/Operator roles, double-bound AI authz) |

## How to add an ADR

1. Copy [`000-template.md`](000-template.md) to `NNN-short-slug.md` with the next 3-digit number.
2. Replace the status + date pills (status colors below). Fill in Context, Decision, Consequences.
3. Add a row to the index above.
4. If the new ADR supersedes an existing one, update the old ADR's status pill to `Superseded` (lightgrey) with the date and a link to the new one.

Status pill colors:

- **Proposed**: `yellow`
- **Accepted**: `brightgreen`
- **Deprecated**: `red`
- **Superseded**: `lightgrey`

## When to read an ADR

- Before contemplating overriding a foundational choice. The ADR captures the reasoning; you may not have all of it.
- When onboarding to the codebase. Skim every ADR title; read the ones that touch your area.
- When the user asks "why is X this way?" Cite the ADR rather than reconstructing the rationale.

## What ADRs are not

ADRs aren't for tactical decisions, configuration footnotes, or working memos. The bar for an ADR is "a future reader of the codebase will ask 'why was this chosen?' and need a real answer."
