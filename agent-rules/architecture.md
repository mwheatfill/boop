# Architecture

The load-bearing patterns this template enforces. Don't override silently; surface deviations and propose ADR edits if you think a pattern is wrong.

## Auth

All identity reads go through `getCurrentUser(request)` in `src/lib/auth/get-current-user.ts`. The function returns:

```ts
type User = {
  id: string
  email: string
  name?: string
  groups: string[]
}
```

(The `User` type lives in `src/shared/types/auth.ts` so client code can import it for UI personalization without pulling in server-only auth code.)

**Don't** import `better-auth` directly from route guards, server functions, or component code. The provider is implementation detail. The abstraction is the boundary.

**Why:** apps ship to either Better Auth + Entra OIDC (default) or Cloudflare Access (recipe). The provider swap is mechanical only because the app talks to the abstraction, not the provider.

**Tenant context is separate.** Multi-tenant apps add a `getActiveTenant()` (or equivalent) call alongside `getCurrentUser()`. Tenant scope is not part of the `User` shape; that's identity-only.

See [ADR-0007](../docs/adr/0007-auth-provider-abstraction.md).

## Data flow

Server functions are the canonical mutation and query path:

```ts
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const InputSchema = z.object({ ... })

export const myFn = createServerFn({ method: 'POST' })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await getCurrentUser(/* request from context */)
    if (!user) throw new Error('Unauthenticated')
    // … business logic
    return result
  })
```

Conventions:

- **Validate input at the edge.** Always `.inputValidator((data) => schema.parse(data))`. The CI guard (`scripts/check-openapi-contract.mjs`) catches no-op validators.
- **Resolve auth at the edge.** Call `getCurrentUser` first, throw on null. Don't push auth checks deeper.
- **Errors are thrown.** TanStack Start catches them and returns appropriate HTTP responses. Don't return error envelopes; throw.
- **Services are pure async functions.** Server functions call services. Services don't know about HTTP.

## API surface and the OpenAPI contract

The `openapi.json` file generated from Zod schemas is the load-bearing API contract. It's:

- Consumed by the `mcp/expose-app-as-mcp-server` recipe to generate agent tools
- Linked from `app/routes/.well-known/api-catalog.ts` for agent discovery
- CI-enforced via `scripts/check-openapi-contract.mjs` (hard gate)

When you add or change a server function, the input schema must be a Zod schema with `zod-openapi` decorations. Run `pnpm openapi:generate` to refresh the spec; the CI check fails if the spec drifts from the code.

See [`agent-rules/api-contract.md`](api-contract.md) for the full contract discipline. See [ADR-0009](../docs/adr/0009-discoverability-in-template.md) for why the contract surface is in the template.

## Database

D1 (SQLite at edge) is the default. Drizzle is the ORM.

```ts
// src/lib/db/client.ts exports a request-scoped factory:
export function createDb(d1: D1Database) {
  return drizzle({ client: d1, schema })
}

// In server functions, get the binding from context:
const db = createDb(env.DB)
```

Schema lives in `src/lib/db/schema.ts`. Migrations are SQL files in `drizzle/` generated via `drizzle-kit generate`.

For Postgres / Neon, see the [`data-layer/switch-to-neon-postgres`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/data-layer) recipe. The swap is mechanical because the rest of the app talks to Drizzle, not the underlying driver.

See [ADR-0003](../docs/adr/0003-d1-default-data-layer.md) and [ADR-0004](../docs/adr/0004-drizzle-orm.md).

## Routing

File-based via TanStack Router. Routes live in `src/routes/`.

- `__root.tsx` — root layout
- `index.tsx` — `/`
- `_pathlessLayout.tsx` — pathless layouts (don't add to URL)
- `posts.$postId.tsx` — dynamic segments
- `(app)/dashboard.tsx` — route groups (parens; don't add to URL)
- `api/<endpoint>.ts` — HTTP API endpoints (use `createServerFileRoute()`)
- `.well-known/<file>.ts` — agent-discovery endpoints

`routeTree.gen.ts` is auto-generated. Don't edit it. Don't commit changes that only touch this file (it'll regenerate on next dev/build).

For auth-aware routes, use `beforeLoad` to gate. The gate fetches the session via a server function and throws a redirect if unauthenticated.

## AI

`src/lib/ai/client.ts` exports a `getAIClient()` helper that reads provider config from the Zod-parsed env. The default provider is Microsoft Foundry via Cloudflare AI Gateway; alternates (Anthropic, OpenAI) are recipes.

The streaming chat route at `src/routes/api/chat.ts` includes the `Content-Encoding: identity` header on the streaming response. **Don't remove this.** Without it, Workers' default compression buffers the SSE stream and the chat appears to hang.

Chat UI lives in `src/routes/chat.tsx` using AI Elements components. Removable; if your app doesn't use AI, delete the route and the AI deps will tree-shake out.

See [ADR-0006](../docs/adr/0006-foundry-via-ai-gateway.md).

## Email

Templates are React Email components in `src/lib/email/templates/`. The send pipeline in `src/lib/email/send.ts` is transport-pluggable; default is Resend, recipes cover Microsoft Graph (default for internal apps) and Cloudflare Email Service.

## Validation

Zod everywhere. The unified schema package is set up in `src/shared/schemas/openapi.ts`:

```ts
import 'zod-openapi'
import { z } from 'zod'
export { z }
```

Import `z` from `@/shared/schemas/openapi` (not directly from `zod`) to get the openapi-decoration extensions.

## Don't

- Don't write a custom auth check that doesn't go through `getCurrentUser()`.
- Don't write a server function with a no-op `inputValidator((d) => d)`. The CI guard catches this; you're just delaying the error.
- Don't bypass Drizzle and write raw SQL except in migrations or for performance-critical reads (and document why).
- Don't import `better-auth`, `pg`, `@neondatabase/serverless`, or `resend` outside their respective `src/lib/` modules.
- Don't add a route handler that returns API data outside `src/routes/api/` or `src/routes/.well-known/`. The discoverability scaffolding assumes those locations.
