// Preferences audit. Greps src/ + scripts/ for forbidden imports
// declared as "don't reach for" in agent-rules/preferences.md. Add a
// row here when you add a row to preferences.md.

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { REPO_ROOT, repoPath, walkTs } from './_fs.ts'
import type { AuditResult, Finding } from './types.ts'

const AUDIT = 'preferences' as const

interface Rule {
  /** Stable id for whitelisting. */
  id: string
  /** Pattern to scan for. Tested against each line of every src file. */
  pattern: RegExp
  /** Action-oriented message: "what's wrong → what to do instead". */
  message: string
  /** Optional path-allowlist; matches via `file.includes(allowed)`. */
  allowedPaths?: string[]
}

const rules: Rule[] = [
  // Query-layer alternatives.
  {
    id: 'no-swr',
    pattern: /from\s+['"]swr['"]/,
    message:
      'Use `@tanstack/react-query` instead of swr (preferences.md → "Client query / cache").',
  },
  {
    id: 'no-apollo-client',
    pattern: /from\s+['"]@apollo\/client['"]/,
    message:
      'Use `@tanstack/react-query` instead of Apollo (preferences.md → "Client query / cache").',
  },
  {
    id: 'no-urql',
    pattern: /from\s+['"]urql['"]/,
    message:
      'Use `@tanstack/react-query` instead of urql (preferences.md → "Client query / cache").',
  },
  // Validation alternatives.
  {
    id: 'no-yup',
    pattern: /from\s+['"]yup['"]/,
    message:
      'Use Zod (via @/shared/schemas/openapi) instead of yup (preferences.md → "Validation").',
  },
  {
    id: 'no-joi',
    pattern: /from\s+['"]joi['"]/,
    message:
      'Use Zod (via @/shared/schemas/openapi) instead of joi (preferences.md → "Validation").',
  },
  // Form alternatives.
  {
    id: 'no-react-hook-form',
    pattern: /from\s+['"]react-hook-form['"]/,
    message:
      'Use TanStack Form for rich forms or React 19 `<form action={fn}>` + `useActionState` for simple ones. Don\'t reach for react-hook-form (preferences.md → "Forms").',
  },
  {
    id: 'no-formik',
    pattern: /from\s+['"]formik['"]/,
    message: 'Use TanStack Form or React 19 Actions instead of Formik (preferences.md → "Forms").',
  },
  // Style alternatives.
  {
    id: 'no-styled-components',
    pattern: /from\s+['"]styled-components['"]/,
    message: 'Use Tailwind v4 instead of styled-components (preferences.md → "Styling").',
  },
  {
    id: 'no-emotion',
    pattern: /from\s+['"]@emotion\/(react|styled)['"]/,
    message: 'Use Tailwind v4 instead of @emotion (preferences.md → "Styling").',
  },
  // UI library alternatives.
  {
    id: 'no-mui',
    pattern: /from\s+['"]@mui\//,
    message:
      'Use shadcn/ui (`npx shadcn@latest add <name>`) instead of MUI (preferences.md → "UI primitives").',
  },
  {
    id: 'no-chakra',
    pattern: /from\s+['"]@chakra-ui\//,
    message: 'Use shadcn/ui instead of Chakra (preferences.md → "UI primitives").',
  },
  {
    id: 'no-mantine',
    pattern: /from\s+['"]@mantine\//,
    message: 'Use shadcn/ui instead of Mantine (preferences.md → "UI primitives").',
  },
  {
    id: 'no-headlessui',
    pattern: /from\s+['"]@headlessui\/react['"]/,
    message:
      'Use shadcn/ui (which wraps Radix) instead of Headless UI (preferences.md → "Headless primitives").',
  },
  // Icon alternatives.
  {
    id: 'no-heroicons',
    pattern: /from\s+['"]@heroicons\/react/,
    message: 'Use lucide-react instead of Heroicons (preferences.md → "Icons").',
  },
  {
    id: 'no-react-icons',
    pattern: /from\s+['"]react-icons\//,
    message: 'Use lucide-react instead of react-icons (preferences.md → "Icons").',
  },
  // HTTP/data fetching.
  {
    id: 'no-axios',
    pattern: /from\s+['"]axios['"]/,
    message:
      'Use the platform `fetch` (or a TanStack Query queryFn around it) instead of axios. Bundles smaller; preferences.md does not list axios as canonical.',
  },
  // Routing alternatives (template uses TanStack Router).
  {
    id: 'no-react-router',
    pattern: /from\s+['"]react-router(-dom)?['"]/,
    message: 'Use @tanstack/react-router (the template router); preferences.md → "Routing".',
  },
  // Headless primitive alternatives. The template uses Base UI (style:
  // base-vega in components.json). Direct radix-ui imports indicate a
  // hand-rolled primitive that should have come from `npx shadcn add`.
  {
    id: 'no-radix-ui',
    pattern: /from\s+['"]radix-ui['"]/,
    message:
      'The template uses Base UI primitives (style: base-vega), not Radix. If you need a primitive, run `npx shadcn@latest add <name>`. preferences.md → "Headless primitives".',
  },
  {
    id: 'no-radix-ui-scoped',
    pattern: /from\s+['"]@radix-ui\//,
    message:
      'The template uses Base UI primitives (style: base-vega), not Radix. preferences.md → "Headless primitives".',
  },
  // Chart alternatives.
  {
    id: 'no-chartjs',
    pattern: /from\s+['"]chart\.js['"]|from\s+['"]react-chartjs-2['"]/,
    message:
      'Use shadcn Chart (Recharts under the hood) via the `charts/setup` recipe. preferences.md → "Charts".',
  },
  {
    id: 'no-victory',
    pattern: /from\s+['"]victory(-[\w-]+)?['"]/,
    message: 'Use shadcn Chart via the `charts/setup` recipe. preferences.md → "Charts".',
  },
  {
    id: 'no-plotly',
    pattern: /from\s+['"]plotly\.js|react-plotly['"]/,
    message: 'Use shadcn Chart via the `charts/setup` recipe. preferences.md → "Charts".',
  },
  {
    id: 'no-nivo',
    pattern: /from\s+['"]@nivo\//,
    message: 'Use shadcn Chart via the `charts/setup` recipe. preferences.md → "Charts".',
  },
  // Motion alternatives.
  {
    id: 'no-react-spring',
    pattern: /from\s+['"](react-spring|@react-spring\/[\w-]+)['"]/,
    message:
      'Use `motion` (formerly Framer Motion) via the `motion/setup` recipe. preferences.md → "Animation".',
  },
  {
    id: 'no-framer-motion',
    pattern: /from\s+['"]framer-motion['"]/,
    message:
      'The package was renamed to `motion` in 2024. Install `motion` and import from `motion/react`. preferences.md → "Animation".',
  },
  {
    id: 'no-gsap',
    pattern: /from\s+['"]gsap(\/[\w-]+)?['"]/,
    message:
      'Use `motion` for layout/gesture/scroll animations; use Tailwind/CSS for simple transitions. preferences.md → "Animation".',
  },
  // Auth provider direct imports outside the abstraction.
  {
    id: 'auth-provider-direct-import',
    pattern: /from\s+['"]better-auth['"]/,
    message:
      "Don't import better-auth directly outside src/lib/auth/. App code reads identity via `getCurrentUser(request)`. See agent-rules/architecture.md.",
    allowedPaths: ['src/lib/auth/'],
  },
  // Cloudflare API direct calls.
  {
    id: 'no-curl-cloudflare-api',
    pattern: /["'`](?:https:\/\/)?api\.cloudflare\.com\//,
    message:
      'Direct calls to api.cloudflare.com bypass the Cloudflare MCP. Use mcp__5aa20009-…__execute (cloudflare:execute) instead. preferences.md → "Cloudflare".',
    // Allow in audit/docs only (strings in markdown explaining the rule).
    allowedPaths: ['scripts/audit-patterns/'],
  },
  // wrangler.config drift.
  {
    id: 'no-wrangler-config-flag',
    pattern: /WRANGLER_CONFIG\s*[=:]\s*["']wrangler\.production\.jsonc["']/,
    message:
      'WRANGLER_CONFIG-based env selection is the old pattern. Use a single wrangler.jsonc with env.production block + CLOUDFLARE_ENV. See ADR-0001.',
  },
]

export function runPreferencesAudit(): AuditResult {
  const findings: Finding[] = []
  const files = [...walkTs(repoPath('src')), ...walkTs(repoPath('scripts'))]

  for (const file of files) {
    const rel = relative(REPO_ROOT, file)
    // The file declaring a rule's pattern matches its own regex.
    if (rel === 'scripts/audit-patterns/preferences.ts') continue
    const lines = readFileSync(file, 'utf8').split('\n')

    for (const rule of rules) {
      if (rule.allowedPaths?.some((p) => rel.startsWith(p))) continue
      lines.forEach((line, idx) => {
        if (rule.pattern.test(line)) {
          findings.push({
            audit: AUDIT,
            severity: 'error',
            file: rel,
            line: idx + 1,
            message: rule.message,
          })
        }
      })
    }
  }

  return { audit: AUDIT, findings, ok: true }
}
