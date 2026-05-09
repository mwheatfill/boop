---
title: "ADR-0004: Drizzle as the ORM"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "Drizzle ORM is the default query builder and migration tool, supporting both D1 and Postgres adapters."
---

# ADR-0004: Drizzle as the ORM

## Status

Accepted (2026-05-09)

## Context

Given D1 default with a Postgres swap recipe ([ADR-0003](0003-d1-default-data-layer.md)), we need an ORM that:

- Speaks both D1 (SQLite dialect) and Postgres with minimal API divergence, so the swap recipe is mechanical.
- Handles migrations cleanly.
- Has a small bundle footprint (Workers bundles want to stay under the 1 MB compressed limit; the ORM is in the client bundle path on SSR).
- Integrates with TypeScript for type-safe schemas.

## Decision

**Drizzle ORM** with `drizzle-kit` for migrations. Schema lives in `src/lib/db/schema.ts`. Migrations are generated SQL files in `drizzle/`.

## Consequences

**Positive:**

- The same query builder API works against D1 and Postgres. Swapping data layers (per the Neon recipe) is changing the adapter import and the client factory; the rest of the app is untouched.
- Lightweight: the runtime is small, no generated client needed.
- Schema-first: Drizzle schemas are TypeScript objects, not a separate DSL. Type inference flows from schema to queries.
- `drizzle-kit` migration generator handles common cases well; complex migrations can be hand-edited in the generated SQL.
- Active development; good Cloudflare D1 support.

**Negative:**

- Smaller community than Prisma. Some patterns (especially complex relations) require digging deeper into docs.
- Migration tooling is less polished than Prisma's. Hand-editing generated SQL is occasionally needed.
- Some advanced TypeScript types (deeply nested relations) can produce slow type-checking.

**Neutral / trade-off:**

- Drizzle is opinionated about schema-as-code (TypeScript). Teams wanting schema-first SQL files (with the ORM reading the SQL) won't get that here. The trade is "TS schemas everywhere" for "code is the source of truth."

## Alternatives considered

- **Prisma** — excellent DX, but the generated client adds bundle weight that's painful on Workers, and the Postgres-to-D1 schema swap requires more careful adapter work. Lost on bundle size and adapter portability.
- **Kysely** — great query builder with strong types, but less ergonomic for migrations and schema definition. Lost on tooling completeness.
- **Raw SQL + a lightweight wrapper** — too much glue. Loses the "type-safe queries" property.
- **TypeORM** — heavier, decorator-based, less aligned with the Workers / edge runtime constraints. Lost on weight.

## References

- [Drizzle ORM documentation](https://orm.drizzle.team/)
- [Drizzle Kit documentation](https://orm.drizzle.team/kit-docs/overview)
- [Drizzle with Cloudflare D1](https://orm.drizzle.team/docs/get-started-sqlite#cloudflare-d1)
- Recipe: `data-layer/switch-to-neon-postgres.md` (covers the adapter swap)
