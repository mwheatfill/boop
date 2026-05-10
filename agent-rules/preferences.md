# Preferences

The opinionated stack. For every concern below, there's a single canonical answer. Don't reach for an alternative without proposing an ADR (`docs/adr/`) that explains why this app needs to deviate.

The `pnpm audit:patterns` CI job enforces this list mechanically: forbidden imports fail the gate, hand-rolled primitives that have canonical equivalents fail the gate, and pattern drift from the canonical sources (shadcn registry, TanStack Intent skills) fails the gate. Adding to the list = adding an audit check.

## Canonical choices

| Concern | Choice | Don't reach for |
|---|---|---|
| Runtime | Cloudflare Workers | Node servers, Deno, Bun (without ADR) |
| Server framework | TanStack Start | Next.js, Remix, Hono (alone), Astro |
| Routing | TanStack Router (file-based) | React Router, Wouter, Reach Router |
| Client query / cache | TanStack Query | SWR, Apollo, urql, hand-rolled `useEffect`+`fetch` |
| Tables | TanStack Table | react-table forks, ag-grid, MUI DataGrid |
| Forms (rich) | TanStack Form | React Hook Form, Formik |
| Forms (simple) | React 19 `<form action={fn}>` + `useActionState` | controlled-component `onSubmit` chains |
| Validation | Zod 4 via `@/shared/schemas/openapi` | Yup, Joi, Valibot, Superstruct |
| UI primitives | shadcn/ui via `npx shadcn@latest add <name>` (style: `base-vega`) | hand-rolling, Material UI, Chakra, Mantine |
| Headless primitives | Base UI (`@base-ui/react`) under shadcn | Radix, Headless UI, Reach UI |
| Charts | shadcn/ui Chart via `charts/setup` recipe (Recharts v3 underneath) | Chart.js, Victory, Plotly, Nivo, ECharts (without ADR) |
| Animation | `motion` (formerly Framer Motion) via `motion/setup` recipe; CSS / Tailwind utilities for simple transitions | react-spring, @react-spring/*, GSAP (without ADR) |
| Toasts | shadcn Sonner (`npx shadcn@latest add sonner`); template ships `<Toaster />` in `__root.tsx`. Call `toast.success(...)` / `toast.error(...)` from `'sonner'` | react-toastify, react-hot-toast, notistack |
| Dashboard composition | `dashboard/scaffold` recipe (runs `npx shadcn@latest add dashboard-01` + adapts to template conventions) | hand-rolled sidebar+chart layout |
| Icons | `lucide-react` | Heroicons, react-icons, Tabler |
| Styling | Tailwind v4 with CSS-first `@theme` config | tailwind.config.{js,ts}, CSS-in-JS, CSS modules |
| Theme | `next-themes` | hand-rolled context |
| Class merging | `cn()` from `@/lib/utils` (clsx + tailwind-merge) | bare `clsx`, manual concatenation |
| Auth | `getCurrentUser()` abstraction; provider via recipe | Direct provider imports outside `src/lib/auth/` |
| Database | Drizzle ORM on Cloudflare D1 | Prisma, Kysely (without ADR), raw SQL |
| Postgres swap | `data-layer/switch-to-neon-postgres` recipe | Direct Neon driver imports |
| AI | Vercel AI SDK | LangChain, raw provider SDKs (without ADR) |
| AI provider routing | Cloudflare AI Gateway → provider | Direct provider URLs |
| Email | React Email templates + `email/send-pipeline` recipe | nodemailer, raw transport SDKs |
| Logging | Structured `console.*` via `@/lib/log` (`logInfo` / `logWarn` / `logError`); Workers Logs auto-indexes the JSON fields. See [`agent-rules/observability.md`](observability.md). | Pino, Winston, Bunyan (Node-only; `pino/browser` is just a `console.log` adapter); raw `console.*` in `src/` |
| Error monitoring | Workers Logs by default; Sentry via `monitoring/sentry` recipe for consumer-facing apps; Application Insights via `monitoring/azure-app-insights` for Azure-fronted apps; OTel export via `monitoring/otel-export` for cross-vendor pipelines | Direct `@sentry/*` / `applicationinsights` imports outside `src/lib/monitoring/` |
| Analytics + feature flags | Cloudflare Web Analytics (page views, free, no SDK); PostHog via `monitoring/posthog` recipe (analytics + flags + session replay) when budget allows | Mixpanel, Amplitude, Segment (without ADR) |
| Tests | Vitest + Testing Library | Jest, Mocha |
| E2E tests | Playwright (via recipe) | Cypress, Puppeteer |
| Lint + format | Biome | ESLint + Prettier |
| Package manager | pnpm | npm, yarn, bun |
| Node | 24.x | older majors |
| Deploy | Wrangler via GitHub Actions, `CLOUDFLARE_ENV` selects env | Cloudflare Workers Builds (without ADR), manual `wrangler deploy` |

## Canonical patterns inside the choices

The "what to use" table is half the story. The "how to use it" patterns matter more for keeping the codebase coherent.

### TanStack stack

- **Server fns colocated with routes** when used by one route; in `src/server/<feature>.ts` when shared.
- **Router context is typed via `MyRouterContext`** in `src/router-context.ts`. Recipes augment via module declaration merging, never by editing the interface in the template.
- **Loaders prefetch via `context.queryClient.ensureQueryData(opts)`**, components read via `useSuspenseQuery(opts)`. The `queryOptions` factory is the shared key/fetcher between loader and component.
- **`createRootRouteWithContext<MyRouterContext>()`**, never bare `createRootRoute`.
- **`createServerFn({ method }).inputValidator(schema.parse).handler(...)`**, never with a no-op validator.

### shadcn

- **Always install via the CLI**: `npx shadcn@latest add <component>`. Never copy from training memory or another project.
- **The style is `base-vega`** (see `components.json`). That's Base UI primitives + the "vega" celestial visual theme (clean default, `rounded-md`, sm font, ring-3). Don't change the style after init; per shadcn docs, this is sticky.
- **Composition uses Base UI's `render` prop, not Radix's `asChild`/`Slot`.** To make a Button render as a custom router Link: `<Button render={<Link to="/x" />}>Label</Button>`. The Link must forward refs and spread props.
- **Don't hand-roll a primitive that shadcn ships.** If you need a Combobox, run the CLI; don't compose one out of base-ui parts manually.
- **`data-slot` attributes are load-bearing.** Don't strip them; canonical CSS selectors depend on them.
- **Sub-components like `<CardTitle>` are `<div>` by default**, not `<h3>`. The data-slot carries the role.
- **Use `cn()` from `@/lib/utils`** to merge classes. Never concatenate with template literals.

### React 19

- **Ref-as-prop, no `forwardRef`.** Type as `ref?: Ref<HTMLElement>` in the prop interface.
- **No `displayName` on function components.** It's a forwardRef-era artifact.
- **No `<Context.Provider>`.** React 19 lets you render the Context value directly: `<MyContext value={x}>`.
- **`<form action={action}>` + `useActionState` for forms with mutations.** Avoid manual `onSubmit` + `useState` for form state.
- **Document metadata via React 19 native tags or framework `head()`.** Don't reach for `react-helmet`.

### Tailwind v4

- **No `tailwind.config.{js,ts}` file.** Config lives in `app.css` via the `@theme` directive.
- **OKLCH color tokens** in CSS variables. Don't switch to HSL or hex.
- **`@custom-variant dark (&:where(.dark, .dark *))`** for dark mode. Don't use `darkMode: 'class'` in JS config.

### Validation + API contract

- **Import `z` from `@/shared/schemas/openapi`**, not directly from `zod`. The module loads the zod-openapi side effect.
- **Decorate schemas with `.meta({ description, example, id })`**, not `.openapi()` (zod-openapi 5.x uses `.meta`).
- **Schemas live in `src/shared/schemas/<domain>.ts`.** Ad-hoc inline schemas don't make it into `openapi.json`.

### Cloudflare

- **`wrangler.jsonc` is single-file** with `env.production` block. `CLOUDFLARE_ENV=production pnpm build` selects prod at build time.
- **Bindings are non-inheritable.** Redefine `vars`, `d1_databases`, etc. in each env block.
- **Read env via `import { env } from 'cloudflare:workers'`** inside server functions. Don't pass `env` as a parameter from outside.
- **Static discovery files** (`robots.txt`, `sitemap.xml`, `llms.txt`, `openapi.json`, `.well-known/*`) live in `public/`. The `_headers` file sets Content-Type for the extensionless ones.
- **Use the Cloudflare MCP** (`mcp__5aa20009-…__execute` / `__search`) before editing wrangler config or making Cloudflare API calls. Never `curl https://api.cloudflare.com/...` directly.

## How to deviate

If you have a real reason to use something outside this list:

1. Open an ADR in `docs/adr/`. Even a short one — what, why, what you considered, what's the cost.
2. Update `agent-rules/preferences.md` (this file) to either change the canonical choice or add an explicit exception.
3. Update the audit-patterns whitelist to permit the new import / pattern.
4. Mention the deviation in the PR description.

Skipping any of these means the next agent reading this file will assume the original choice and either revert your change or layer drift on top of it.
