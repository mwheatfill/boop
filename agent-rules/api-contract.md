# API contract

`public/openapi.json` is the load-bearing contract. Treat it like a schema, not an artifact.

## What it is

`public/openapi.json` describes every server function's input shape, output shape, auth requirements, and error responses. It's generated from the Zod schemas decorated with zod-openapi 5.x metadata, executed by `scripts/generate-openapi.ts` at build time. Both `generate-openapi.ts` and `check-openapi-contract.ts` import the same OpenAPI document builder from `scripts/openapi-document.ts` so generation and verification can never disagree.

## Who reads it

- **The MCP server recipe** (`mcp/expose-app-as-mcp-server`) reads `openapi.json` to generate agent tools. New endpoints in the API show up as tools automatically.
- **The `.well-known/api-catalog` static file** at `public/.well-known/api-catalog` links to it for agent discovery.
- **Generated client SDKs** (when an app needs them) are built from it.
- **AI agents** working in the codebase consult it to understand the API surface without reading every server function file.
- **The CI guard** (`scripts/check-openapi-contract.ts`, run via `pnpm openapi:check`) checks for drift between server function definitions and the published spec. Hard gate; deploys fail when this drifts.

## How to add an endpoint

1. **Define the input Zod schema** in `src/shared/schemas/<domain>.ts`. Use `z` imported from `@/shared/schemas/openapi` (which has the zod-openapi side effect loaded). Decorate fields with `.meta({ description, example })` where useful.

2. **Write the server function** alongside the route file in `src/routes/...` (TanStack Start colocates server functions with their routes). Wire `.inputValidator((data) => schema.parse(data))` and `.handler(...)`.

3. **Run `pnpm openapi:generate`.** This refreshes `public/openapi.json` from the schemas in `src/shared/schemas/` via `scripts/openapi-document.ts`.

4. **Commit `public/openapi.json` alongside the code change.** The spec is committed to the repo (not a build artifact) so PRs show the API surface diff inline.

## What the CI guard catches

`scripts/check-openapi-contract.ts` runs in CI before deploy via `pnpm openapi:check`. It rebuilds the OpenAPI document in memory from the same source as `generate-openapi.ts` and compares it byte-for-byte with the committed `public/openapi.json`. It catches:

- Server functions with `.inputValidator((d) => d)` (no-op pass-through). Real validation must use `schema.parse(data)`.
- Server functions whose input schema isn't in `src/shared/schemas/`. The spec is generated from that directory; ad-hoc schemas don't make it into the contract.
- `public/openapi.json` not regenerated after a schema change (file out of sync with code).

Don't bypass the guard. If it fails, fix the underlying problem.

## Updating an endpoint

Breaking changes to an existing endpoint:

1. Update the Zod schema. Decorate breaking changes (e.g., new required field).
2. Run `pnpm openapi:generate`.
3. **Bump the API version** if the change is breaking for external consumers (MCP server, agent tools, generated clients). Surface this in the PR description.
4. Update any in-app callers.

Non-breaking additions (new optional field, new endpoint): no version bump needed.

## OpenAPI conventions in this repo

- **Paths follow the route file path.** Server function colocated with `src/routes/api/users/get.ts` is reachable at `/api/users/get` (or whatever the routing wires up).
- **Operations use `.meta({ id, summary, description, tags })` on the route schema.** `tags` group endpoints in the catalog; `id` becomes the OpenAPI `operationId`.
- **Auth is documented per-endpoint.** Endpoints requiring auth declare `security: [{ bearerAuth: [] }]` (or the equivalent for session cookies). Public endpoints declare `security: []` explicitly.
- **Errors are documented.** Common error responses (401, 403, 422) are shared schemas. Use them; don't redefine inline.

## Don't

- Don't hand-edit `public/openapi.json`. It's generated.
- Don't add an endpoint without a Zod schema in `src/shared/schemas/`.
- Don't return data shapes that diverge from what `openapi.json` describes. Agent tools assume the spec is accurate.
- Don't disable the CI guard to ship a deploy. Fix the spec.
