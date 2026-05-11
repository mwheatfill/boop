# ADR-009: Opinionated stack with mechanical pattern enforcement

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--09-blue)

## Context

Two failure modes drove this. First, agents pattern-match on the codebase: if the template ships hand-rolled UI primitives, future agent sessions hand-roll more; if the template uses an idiosyncratic data-fetching pattern, future sessions duplicate it. The template is gravitational; whatever it teaches, agents repeat. Second, prose rules don't reliably constrain agents: a canonical-stack section in `AGENTS.md` gets ignored because the rendered code is louder. Drift compounds in both directions.

## Decision

`pnpm audit:patterns` runs three checks at PR time. Each defends something the soft layers (AGENTS.md, the research-first hook, the `pnpm add` permission gate, code review) can't reliably catch on their own:

1. **shadcn structural diff** ([`scripts/audit-patterns/shadcn.ts`](../../scripts/audit-patterns/shadcn.ts)) — every `src/components/ui/*.tsx` is structurally diffed against the live shadcn registry for the configured style. When shadcn changes a canonical primitive upstream, the next audit run flags us. Per-component allowlist for documented deviations.
2. **TanStack pattern assertions** ([`scripts/audit-patterns/tanstack.ts`](../../scripts/audit-patterns/tanstack.ts)) — structural checks that the version-locked Intent skills declare canonical: `createRootRouteWithContext`, server-fn `inputValidator` presence on mutating methods, native `resolve.tsconfigPaths` over the legacy plugin, SSR query integration setup.
3. **Seam guards** ([`scripts/audit-patterns/preferences.ts`](../../scripts/audit-patterns/preferences.ts)) — direct imports of providers that bypass an in-repo abstraction: `@/lib/log` (vs raw `console.*`), `getCurrentUser` (vs `better-auth` / `next-auth` / `@clerk/*` / `@workos-inc/*` / `@auth0/*` / `lucia` / `iron-session`), shadcn primitives (vs `radix-ui` / `@radix-ui/*`). Plus the single-`wrangler.jsonc` env-selection pattern (catches CI-script drift).

Preferences that aren't architectural seams (TanStack Query vs swr, Zod vs Yup, date-fns vs dayjs, etc.) live in AGENTS.md. They're caught by the `pnpm add` permission gate at install time, the research-first hook at write time, and code review at PR time. The audit doesn't enumerate them.

## Consequences

**Positive:**

- The audit stays small and signal-dense. Every rule fires for a real architectural reason, not as catalog theatre.
- Recipes own their own seam guards. The `monitoring/sentry` recipe adds the `@sentry/*`-outside-`src/lib/monitoring/` rule when installed; the template doesn't pre-defend seams that don't exist yet.
- Drift on real seams is visible at PR time. shadcn upstream changes surface within one CI run.

**Negative:**

- Some classes of preference (an agent reaches for `dayjs` when `date-fns` is canonical) escape mechanical enforcement and rely on softer layers. The trade-off: a small high-signal audit beats a sprawling list whose four load-bearing rules get lost in the noise.

**Neutral / trade-off:**

- shadcn style is `base-vega` (Base UI primitives + the "vega" visual theme). 14 themes split as 7 visual themes × 2 primitive layers; base-ui is React-19-native, smaller bundle (~6KB vs ~9KB for Dialog), and has 7 funded MUI staff vs Radix's smaller post-acquisition team. Agent-driven generation cares more about internal consistency than about Radix's third-party block ecosystem. ([ADR-008](008-ui-visual-layer.md) inherits this rationale.)
- TanStack Query, Table, and Form belong in the template (or as canonical recipe choices), not as alternatives to evaluate. Once you've picked TanStack as the framework family, the family ships together.
