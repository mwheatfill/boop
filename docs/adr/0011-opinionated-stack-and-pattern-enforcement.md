---
title: "ADR-0011: Opinionated stack with mechanical pattern enforcement"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
description: "Single canonical choice per concern, listed in agent-rules/preferences.md, enforced by a pnpm audit:patterns CI gate."
---

# ADR-0011: Opinionated stack with mechanical pattern enforcement

## Status

Accepted (2026-05-09)

## What

For every architectural concern (routing, query/cache, tables, forms, UI primitives, validation, auth, AI, email, tests, etc.), the template declares a single canonical choice in [`agent-rules/preferences.md`](../../agent-rules/preferences.md). A `pnpm audit:patterns` CI gate enforces the list mechanically: forbidden imports fail the gate; hand-rolled primitives that have canonical equivalents fail the gate; pattern drift from canonical sources (the shadcn registry, version-locked TanStack Intent skills) fails the gate.

Deviations require an ADR. The audit ships an allowlist for documented exceptions.

## Why

Two failure modes drove this:

1. **Agents pattern-match on the codebase.** If the template ships hand-rolled UI primitives, future agent sessions hand-roll more. If the template uses an idiosyncratic data-fetching pattern, future sessions duplicate it. The template is gravitational; whatever it teaches, agents repeat. Drift compounds.

2. **Prose rules don't reliably constrain agents.** Even with a canonical-stack section in `AGENTS.md`, an agent reading the codebase will trust what the codebase actually does over what the rules say to do. The stack section gets ignored because the rendered code is louder.

Mechanical enforcement (CI gate) breaks both cycles: the audit reads the canonical sources at run time (shadcn registry, Intent skills locked to installed package versions), structural-diffs against the codebase, and fails the build on drift. That's the same mechanism a *good* agent should use; the gate just makes the verification non-optional.

## When this default is right

Always, for opinionated codebases that intend to compound pattern coherence over time. The audit makes the cost of drift visible at the PR level, not when someone re-audits months later.

## When to switch

Don't. If a particular preference becomes wrong (e.g., shadcn ships a breaking change to canonical Card and we want to stay on the old shape), update `preferences.md` and the audit allowlist; don't disable the audit.

## Notable

- **The preferences list is a living document.** Adding a new concern (e.g., "for charts use Recharts") means: add a row to `preferences.md`, add a check to `scripts/audit-patterns/preferences.ts`, ship both in the same PR.
- **The audit grounds in current sources, not in our rules file.** Shadcn drift is detected by fetching the canonical Button source from `https://ui.shadcn.com/r/styles/new-york-v4/button.json` at run time, not by comparing to a snapshot in our repo. When shadcn changes the canonical Button next year, the next audit run flags us as drifted automatically.
- **TanStack Query, Table, and Form belong in the template** (or are documented as canonical recipe choices), not as alternatives to evaluate. Once you've chosen TanStack as the framework family, the family ships together. Apps that don't need Tables/Forms simply don't import them.
- **Recipes are bound by the same preferences.** A recipe that introduces a new concern (e.g., a "reports" recipe needing charts) updates `preferences.md` and the audit; it doesn't get to introduce its own competing choices.

## References

- [`agent-rules/preferences.md`](../../agent-rules/preferences.md): the list itself
- [`scripts/audit-patterns/`](../../scripts/audit-patterns/): the enforcement scripts
- [shadcn-ui registry](https://ui.shadcn.com/r/styles/new-york-v4/index.json): canonical source for primitive drift detection
