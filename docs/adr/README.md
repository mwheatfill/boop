---
title: "Architecture Decision Records"
type: "ADR Index"
status: Active
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "Index of architecture decisions for template-cf-fullstack."
---

# Architecture Decision Records

These ADRs capture the rationale behind the major platform, framework, and library choices in this template. Read one when you're asking "why was X chosen?" or contemplating an override.

Format follows Michael Nygard's pattern: status, context, decision, consequences, alternatives.

## Index

| ADR | Status | Topic |
|---|---|---|
| [0000](0000-template.md) | Reference | ADR template (copy this for new ADRs) |
| [0001](0001-cloudflare-workers-runtime.md) | Accepted | Cloudflare Workers as the runtime |
| [0002](0002-tanstack-start-framework.md) | Accepted | TanStack Start as the framework |
| [0003](0003-d1-default-data-layer.md) | Accepted | Cloudflare D1 default; Neon Postgres via recipe |
| [0004](0004-drizzle-orm.md) | Accepted | Drizzle as the ORM |
| [0005](0005-better-auth-with-entra-default.md) | Accepted | Better Auth + Entra OIDC default; Cloudflare Access via recipe |
| [0006](0006-foundry-via-ai-gateway.md) | Accepted | Microsoft Foundry via Cloudflare AI Gateway |
| [0007](0007-auth-provider-abstraction.md) | Accepted | Auth provider abstraction (`getCurrentUser`) |
| [0008](0008-neutral-agent-governance.md) | Accepted | Neutral agent governance (AGENTS.md + agent-rules/) |
| [0009](0009-discoverability-in-template.md) | Accepted | Discoverability surface in the template |
| [0010](0010-skill-currency-protocol.md) | Accepted | Skill currency protocol (Intent + MCP servers) |

## How to add an ADR

1. Copy [`0000-template.md`](0000-template.md) to `NNNN-short-slug.md` with the next number.
2. Fill in status, context, decision, consequences, alternatives.
3. Link from this index.
4. If the new ADR supersedes an existing one, update the old ADR's status to `Superseded by ADR-NNNN`.

## When to read an ADR

- Before contemplating overriding a foundational choice. The ADR captures the reasoning; you may not have all of it.
- When onboarding to the codebase. Skim every ADR title; read the ones that touch your area.
- When the user asks "why is X this way?" Cite the ADR rather than reconstructing the rationale.

## What ADRs are not

ADRs aren't for tactical decisions, configuration footnotes, or working memos. The bar for an ADR is "a future reader of the codebase will ask 'why was this chosen?' and need a real answer."
