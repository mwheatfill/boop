# ADR-013: Forms + validation (TanStack Form, React 19 actions, Zod)

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--10-blue)

## Context

Forms, input validation, and the OpenAPI contract are entangled: the same shape validates the form, validates the server function input, and emits the API surface. Picking the form library, the validation library, and the contract pipeline separately invites drift, e.g. a Zod schema for the API plus a different resolver in the form that loses one of the constraints, or an inline `.parse()` in a route file that never makes it into `openapi.json`. One stated thesis covering all three keeps the chain coherent.

## Decision

Forms and validation share a single canonical chain: TanStack Form for rich state-laden forms, React 19's `<form action>` + `useActionState` for simple ones, and Zod 4 through the `@/shared/schemas/openapi` re-export for validation everywhere (forms, server functions, and the `openapi.json` emission). Schemas live in `src/shared/schemas/<domain>.ts` and are imported from `@/shared/schemas/openapi`, not directly from `zod`.

| Concern | Choice | Over |
|---|---|---|
| Forms (rich) | [TanStack Form](https://tanstack.com/form/latest); state, validation, async submission, multi-step | React Hook Form, Formik (lose family coherence with the rest of the TanStack stack per [ADR-002](002-tanstack-start-framework.md)) |
| Forms (simple) | React 19 `<form action={fn}>` + `useActionState` | Controlled-component `onSubmit` + `useState` chains (more code for less behavior) |
| Validation | [Zod 4](https://zod.dev/) imported from `@/shared/schemas/openapi` (the type-augmentation seam for zod-openapi 5.x) | Yup, Joi (no first-class TS inference); Valibot (smaller bundle but no zod-openapi adapter); Superstruct (smaller community) |
| Schema location | `src/shared/schemas/<domain>.ts` | Ad-hoc inline schemas (don't make it into `openapi.json`) |
| Schema metadata | `.meta({ description, example, id })` per zod-openapi 5.x | `.openapi()` (the older zod-openapi syntax) |
| Server fn input | `createServerFn({ method }).inputValidator((data) => schema.parse(data)).handler(...)` | No-op validators, manual parsing inside the handler |

The CI guard `pnpm openapi:check` (script: `scripts/check-openapi-contract.ts`) blocks deploys when a server function's validated input drifts from `public/openapi.json`. Contract regeneration runs via `pnpm openapi:generate`.

## Consequences

**Positive:**

- One validator across forms, server function inputs, and the OpenAPI contract. No parallel definitions, no drift between layers.
- `public/openapi.json` stays current automatically; consumers (the [`mcp/expose-app-as-mcp-server`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/mcp/expose-app-as-mcp-server) recipe, the `.well-known/api-catalog` linkset per [ADR-012](012-discoverability-in-template.md), external clients) get a faithful surface.
- React 19's simple-form path means most "post a form, write a row" cases need no form library at all, just a server function and a `<form action>`.

**Negative:**

- Locked into Zod. Apps that want Valibot's bundle-size advantage need an ADR; the bundle hit is real for Workers' 1 MB compressed-bundle ceiling but rarely load-bearing for line-of-business apps.
- Locked into TanStack Form for rich forms; React Hook Form is more popular and has more recipes. Mitigated by family coherence value (TanStack is already the framework family per [ADR-002](002-tanstack-start-framework.md)).

**Neutral / trade-off:**

- The simple-form pattern requires React 19. Already required by the rest of the stack; not an additional constraint.
- Schemas in `src/shared/schemas/` are imported by both client and server code. Keep them server-safe (no node-only imports, no environment-dependent behavior); the OpenAPI generator runs them at build time.
