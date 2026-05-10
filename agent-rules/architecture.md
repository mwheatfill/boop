# Architecture

The load-bearing patterns this template enforces. Don't override silently; surface deviations and propose ADR edits if you think a pattern is wrong.

## Auth

All identity reads go through `getCurrentUser(request)` in `src/lib/auth/get-current-user.ts`. The function returns:

```ts
type User = {
  id: string
  email: string
  name?: string
  image?: string
  groups: string[]
}
```

The full Zod schema lives in `src/shared/schemas/auth.ts` (so it flows into `openapi.json`); the matching TypeScript type is re-exported from `src/shared/types/auth.ts` for client code that wants UI personalization without pulling in server-only auth code.

The default implementation returns `null`. An auth recipe (e.g. `auth/better-auth`, `auth/cloudflare-access`) replaces the body with a real provider integration. **Don't** import an auth provider library directly from route guards, server functions, or component code. The provider is implementation detail. The abstraction is the boundary.

**Why:** apps ship to whichever auth recipe is installed, and the swap is mechanical only because the app talks to the abstraction, not the provider.

**Tenant context is separate.** Multi-tenant apps add a `getActiveTenant()` (or equivalent) call alongside `getCurrentUser()`. Tenant scope is not part of the `User` shape; that's identity-only.

See [ADR-0007](../docs/adr/0007-auth-provider-abstraction.md).

## Data flow

Server functions are the canonical mutation and query path. They live colocated with their routes in `src/routes/`:

```ts
import { createServerFn } from '@tanstack/react-start'
import { z } from '@/shared/schemas/openapi'
import { getCurrentUser } from '@/lib/auth/get-current-user'

const InputSchema = z.object({ /* ... */ })

export const myFn = createServerFn({ method: 'POST' })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const user = await getCurrentUser(context.request)
    if (!user) throw new Error('Unauthenticated')
    // … business logic
    return result
  })
```

Conventions:

- **Validate input at the edge.** Always `.inputValidator((data) => schema.parse(data))`. The CI guard (`scripts/check-openapi-contract.ts`) catches no-op validators.
- **Resolve auth at the edge.** Call `getCurrentUser` first, throw on null. Don't push auth checks deeper.
- **Errors are thrown.** TanStack Start catches them and returns appropriate HTTP responses. Don't return error envelopes; throw.
- **Services are pure async functions.** Server functions call services. Services don't know about HTTP.

## API surface and the OpenAPI contract

The `public/openapi.json` file generated from Zod schemas is the load-bearing API contract. It's:

- Consumed by the `mcp/expose-app-as-mcp-server` recipe to generate agent tools
- Linked from the static `public/.well-known/api-catalog` file for agent discovery
- CI-enforced via `scripts/check-openapi-contract.ts` (hard gate, run by `pnpm openapi:check`)

When you add or change a server function, the input schema must be a Zod schema with zod-openapi 5.x `.meta(...)` decorations. Run `pnpm openapi:generate` to refresh the spec; the CI check fails if the spec drifts from the code.

See [`agent-rules/api-contract.md`](api-contract.md) for the full contract discipline. See [ADR-0009](../docs/adr/0009-discoverability-in-template.md) for why the contract surface is in the template.

## Database

D1 (SQLite at edge) is the default. Drizzle is the ORM. Schema starts empty.

```ts
// src/lib/db/client.ts exports a request-scoped factory:
export function createDb(d1: D1Database) {
  return drizzle({ client: d1, schema })
}

// In server functions, get the binding from the Workers env:
import { env } from 'cloudflare:workers'
const db = createDb(env.DB)
```

Schema lives in `src/lib/db/schema.ts` (empty stub by default; recipes such as `auth/better-auth` extend it). Migrations are SQL files in `drizzle/`, generated via `pnpm db:generate` (which calls `drizzle-kit generate`) and applied to the runtime via `pnpm exec wrangler d1 migrations apply DB --remote` (or the `--local` variant in dev). CI runs the wrangler command on deploy; `drizzle-kit migrate` is not used here because D1 needs migrations applied through wrangler.

For Postgres / Neon, see the planned [`data-layer/switch-to-neon-postgres`](https://github.com/mwheatfill/app-platform-recipes#planned-recipes) recipe. The swap is mechanical because the rest of the app talks to Drizzle, not the underlying driver.

See [ADR-0003](../docs/adr/0003-d1-default-data-layer.md) and [ADR-0004](../docs/adr/0004-drizzle-orm.md).

## Routing

File-based via TanStack Router. Routes live in `src/routes/`.

- `__root.tsx`: root layout
- `index.tsx`: `/`
- `_pathlessLayout.tsx`: pathless layouts (don't add to URL)
- `posts.$postId.tsx`: dynamic segments
- `(app)/dashboard.tsx`: route groups (parens; don't add to URL)
- `api/<endpoint>.ts`: HTTP API endpoints (use `createServerFileRoute()`); add as recipes do
- File names with literal dots use the TanStack Router escape `[.]`, e.g. `[.]well-known/api-catalog.ts`. The template currently ships `.well-known/*` as static files in `public/.well-known/` instead; recipes that need dynamic well-known endpoints add the route file.

`routeTree.gen.ts` is auto-generated. Don't edit it. Don't commit changes that only touch this file (it'll regenerate on next dev/build).

For auth-aware routes, use `beforeLoad` to gate. The gate fetches the session via a server function and throws a redirect if unauthenticated.

## Discoverability surface

The template ships static discovery files in `public/`:

- `public/sitemap.xml`, `public/robots.txt`, `public/llms.txt`
- `public/openapi.json` (regenerated by `pnpm openapi:generate`)
- `public/.well-known/api-catalog` (linkset pointing at `openapi.json`)
- `public/.well-known/mcp-server-card` (placeholder; the `mcp/expose-app-as-mcp-server` recipe populates it)
- `public/_headers` sets `Content-Type` for the extensionless `.well-known/*` files (Cloudflare Workers Static Assets serves them as `application/octet-stream` otherwise)

See [ADR-0009](../docs/adr/0009-discoverability-in-template.md).

## AI

**Recipe-only.** The template ships nothing AI-related. Install `ai/chat-route` for the streaming endpoint, `ai/chat-ui` for the surface, and a provider recipe (e.g. `microsoft-foundry/chat-completion`). The `ai/chat-route` recipe is the source of truth for the `Content-Encoding: identity` SSE workaround that Cloudflare Workers needs; don't reinvent the streaming wiring outside that recipe.

See [ADR-0006](../docs/adr/0006-foundry-via-ai-gateway.md) for the AI Gateway rationale.

## Email

**Recipe-only.** The template ships nothing email-related. Install `email/send-pipeline` for the dispatcher and `email/<transport>` for the actual wire (e.g. `email/graph-shared-mailbox`). Templates are React Email components added under `src/lib/email/templates/` once `email/welcome-template` (or your own) is installed.

## Validation

Zod everywhere. The unified schema package is set up in `src/shared/schemas/openapi.ts`:

```ts
import 'zod-openapi'
import { z } from 'zod'
export { z }
```

Import `z` from `@/shared/schemas/openapi` (not directly from `zod`) to load the zod-openapi side effect before any schema is defined. Decorate schemas with the built-in Zod 4 `.meta(...)` API; zod-openapi 5.x reads it.

## Don't

- Don't write a custom auth check that doesn't go through `getCurrentUser()`.
- Don't write a server function with a no-op `inputValidator((d) => d)`. The CI guard catches this; you're just delaying the error.
- Don't bypass Drizzle and write raw SQL except in migrations or for performance-critical reads (and document why).
- Don't import an auth provider library, an AI SDK provider, or an email transport SDK outside the `src/lib/<concern>/` module that the corresponding recipe owns. The abstraction is the boundary.
- Don't add a route handler that returns API data outside `src/routes/api/` or paths that match the discoverability scaffolding. Recipes assume those locations.
