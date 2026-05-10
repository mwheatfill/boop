# ADR-009: Opinionated stack with mechanical pattern enforcement

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--09-blue)

## Context

Two failure modes drove this. First, agents pattern-match on the codebase: if the template ships hand-rolled UI primitives, future agent sessions hand-roll more; if the template uses an idiosyncratic data-fetching pattern, future sessions duplicate it. The template is gravitational; whatever it teaches, agents repeat. Second, prose rules don't reliably constrain agents: a canonical-stack section in `AGENTS.md` gets ignored because the rendered code is louder. Drift compounds in both directions.

## Decision

For every architectural concern (routing, query/cache, tables, forms, UI primitives, validation, auth, AI, email, tests, etc.), the template declares a single canonical choice in [`scripts/audit-patterns/preferences.ts`](../../scripts/audit-patterns/preferences.ts) (TypeScript; the source of truth that the audit gate reads at run time). A `pnpm audit:patterns` CI gate enforces the list mechanically: forbidden imports fail the gate; hand-rolled primitives that have canonical equivalents fail the gate; pattern drift from the canonical sources (the shadcn registry, version-locked TanStack Intent skills) fails the gate. The audit reads canonical sources at run time (not snapshots in this repo), so when shadcn changes the canonical Button next year, the next audit run flags us as drifted automatically. Deviations require an ADR; the audit ships an allowlist for documented exceptions.

## Consequences

**Positive:**

- Mechanical enforcement breaks the rules-vs-codebase drift cycle. Drift is visible at PR time, not when someone re-audits months later.
- Adding a new concern is a `preferences.md` row + an audit check + ADR if needed, all in one PR.
- Recipes inherit the preferences automatically; cross-recipe consistency is the default.

**Negative:**

- The preferences list is a living TypeScript source. Adding a new concern (e.g., "for charts use Recharts") means adding a rule to [`scripts/audit-patterns/preferences.ts`](../../scripts/audit-patterns/preferences.ts) and a documenting ADR, shipping both in the same PR.
- shadcn upstream risk: if shadcn changes a primitive's canonical shape, the audit flags drift and we react. Acceptable given the early signal it provides.

**Neutral / trade-off:**

- shadcn style is `base-vega` (Base UI primitives + the "vega" celestial visual theme). The 14 themes split as 7 visual themes × 2 primitive layers; we picked base-ui because it's React-19-native, smaller bundle (~6KB vs ~9KB for Dialog), and has 7 funded MUI staff vs Radix's smaller post-acquisition team. The agent-driven generation context cares more about internal consistency than about Radix's third-party block ecosystem. ([ADR-008 Headless](008-ui-visual-layer.md) inherits this rationale.)
- TanStack Query, Table, and Form belong in the template (or are documented as canonical recipe choices), not as alternatives to evaluate. Once you've chosen TanStack as the framework family, the family ships together.
