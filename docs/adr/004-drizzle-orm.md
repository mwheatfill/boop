# ADR-004: Drizzle as the ORM

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--09-blue)

## Context

Workers caps compressed bundles at 1 MB, which rules out Prisma's generated client at scale for many apps. The ORM also has to speak both SQLite and Postgres dialects so the D1→Neon swap ([ADR-003](003-d1-default-data-layer.md)) stays mechanical rather than a rewrite. Schema-as-code is the team default.

## Decision

[Drizzle ORM](https://orm.drizzle.team/) as the ORM, with schemas as TypeScript objects in `src/lib/db/schema.ts` (empty stub by default; recipes such as `auth/better-auth` extend it). [`drizzle-kit generate`](https://orm.drizzle.team/kit-docs/overview) writes new SQL migrations into `drizzle/`. CI applies them to D1 with `pnpm exec wrangler d1 migrations apply DB --remote` (dev) or `... --env production --remote` (prod); `drizzle-kit migrate` is not used because D1 needs migrations applied through wrangler so they're recorded in the D1 migrations table. `drizzle-kit push` is local-dev only; never run it against a production DB.

## Consequences

**Positive:**

- One ORM API across SQLite (D1) and Postgres (Neon) keeps the data-layer swap mechanical.
- Small runtime footprint fits the Workers 1 MB compressed bundle ceiling.
- Type inference flows from schema to queries automatically.

**Negative:**

- Less ergonomic than Prisma's generated client for complex relations; occasionally needs explicit typing for performance.
- No client-generation step, so IDE autocomplete on relations is slightly less polished than Prisma.
