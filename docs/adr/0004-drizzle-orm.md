---
title: "ADR-0004: Drizzle as the ORM"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
description: "Drizzle ORM speaks both D1 and Postgres dialects, keeping the data-layer swap mechanical."
---

# ADR-0004: Drizzle as the ORM

## Status

Accepted (2026-05-09)

## What

Drizzle is the ORM. Schemas are TypeScript objects in `src/lib/db/schema.ts`. `drizzle-kit` generates SQL migrations.

## When this default is right

- Want one ORM API across SQLite (D1) and Postgres (Neon) so the data-layer swap stays mechanical
- Care about bundle weight (Workers caps compressed bundles at 1 MB; Drizzle's runtime is small)
- TypeScript-heavy team that prefers schema-as-code

## When to switch

- Want Prisma's generated client ergonomics and don't mind the bundle weight
- Prefer schema-first SQL files (with the ORM reading the SQL) — pick something else

## Notable

- `drizzle-kit migrate` is the production-DB migration command; CI runs this before deploy.
- `drizzle-kit push` is for local dev iteration only — never run against a production DB.
- Type inference flows from schema to queries automatically; complex relations occasionally need explicit typing for performance.

## References

- [Drizzle ORM documentation](https://orm.drizzle.team/)
- [Drizzle Kit documentation](https://orm.drizzle.team/kit-docs/overview)
