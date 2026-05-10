// TanStack pattern audit. Asserts a fixed set of structural invariants
// that the version-locked TanStack Intent skills declare as canonical
// for our installed @tanstack/* versions. These are the invariants that
// agents tend to drift on when invoking from training-data memory.
//
// Add a check here whenever you catch an agent producing one of the
// canonical-deviation patterns. Each check is a small assertion against
// a specific file or set of files. Findings cite the specific TanStack
// Intent SKILL.md path so a reviewer (or agent) can read the source.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AuditResult, Finding } from './types.ts'

const REPO_ROOT = process.cwd()

interface Check {
  name: string
  file: string
  /** Returns null if the file doesn't apply, or the source string. */
  source: () => string | null
  /** Returns a finding to push, or null if the check passed. */
  check: (source: string) => Omit<Finding, 'audit' | 'file'> | null
}

const checks: Check[] = [
  {
    name: 'tsconfig.verbatimModuleSyntax-disabled',
    file: 'tsconfig.json',
    source: () => readFileSync(join(REPO_ROOT, 'tsconfig.json'), 'utf8'),
    check: (src) => {
      const enabled = /"verbatimModuleSyntax"\s*:\s*true/.test(src)
      return enabled
        ? {
            severity: 'error',
            message:
              '`verbatimModuleSyntax: true` causes server bundles to leak into client bundles. Drop it. See @tanstack/react-start/skills/react-start/SKILL.md (HIGH severity).',
            source: 'react-start SKILL.md, "tsconfig" section',
          }
        : null
    },
  },
  {
    name: 'root-route-uses-with-context',
    file: 'src/routes/__root.tsx',
    source: () => readFileSync(join(REPO_ROOT, 'src/routes/__root.tsx'), 'utf8'),
    check: (src) => {
      const usesBare = /createRootRoute\s*\(/.test(src) && !/createRootRouteWithContext/.test(src)
      return usesBare
        ? {
            severity: 'error',
            message:
              'Use `createRootRouteWithContext<MyRouterContext>()` instead of bare `createRootRoute`. Recipes that need context (auth, query, db) require the typed factory; bare creates a fork-the-template trap.',
            source: 'TanStack Router data-loading skill',
          }
        : null
    },
  },
  {
    name: 'router-context-shape-exists',
    file: 'src/router-context.ts',
    source: () => {
      const p = join(REPO_ROOT, 'src/router-context.ts')
      return existsSync(p) ? readFileSync(p, 'utf8') : null
    },
    check: (src) => {
      const hasInterface = /interface\s+MyRouterContext\b/.test(src)
      return hasInterface
        ? null
        : {
            severity: 'error',
            message:
              "src/router-context.ts must export `interface MyRouterContext` (the module-augmentation seam recipes extend). A type alias won't work for module merging.",
          }
    },
  },
  {
    name: 'no-no-op-input-validators',
    file: 'src/routes/**/*.{ts,tsx}',
    source: () => {
      // Walk src/routes and concatenate. Cheap, the repo is small.
      const dir = join(REPO_ROOT, 'src/routes')
      if (!existsSync(dir)) return null
      const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
      function walk(d: string): string[] {
        return readdirSync(d).flatMap((name: string) => {
          const p = join(d, name)
          if (statSync(p).isDirectory()) return walk(p)
          if (/\.(ts|tsx)$/.test(name)) return [readFileSync(p, 'utf8')]
          return []
        })
      }
      return walk(dir).join('\n--FILE--\n')
    },
    check: (src) => {
      // Catches `.inputValidator((d) => d)` and `.inputValidator((data) => data)`
      // as no-op pass-throughs. Real validation must call schema.parse.
      const noop = /\.inputValidator\s*\(\s*\(\s*(\w+)\s*\)\s*=>\s*\1\s*\)/.test(src)
      return noop
        ? {
            severity: 'error',
            message:
              'No-op `.inputValidator((d) => d)` found in a route file. Real validation must call `schema.parse(data)`. See agent-rules/api-contract.md.',
          }
        : null
    },
  },
  {
    name: 'vite-config-uses-tsconfig-paths-plugin',
    file: 'vite.config.ts',
    source: () => readFileSync(join(REPO_ROOT, 'vite.config.ts'), 'utf8'),
    check: (src) => {
      const usesBogusOption = /resolve\s*:\s*\{[^}]*tsconfigPaths\s*:\s*true/.test(src)
      const importsPlugin = /from\s+['"]vite-tsconfig-paths['"]/.test(src)
      if (usesBogusOption) {
        return {
          severity: 'error',
          message:
            "`resolve.tsconfigPaths: true` is not a Vite option (only worked as a side effect of TanStack Start's resolver). Use the `vite-tsconfig-paths` plugin instead.",
        }
      }
      if (!importsPlugin) {
        return {
          severity: 'warn',
          message:
            'vite.config.ts does not import vite-tsconfig-paths. If `@/*` aliases work, the resolution is happening implicitly; the plugin is the documented Vite-canonical mechanism.',
        }
      }
      return null
    },
  },
  {
    name: 'router-has-ssr-query-integration',
    file: 'src/router.tsx',
    source: () => readFileSync(join(REPO_ROOT, 'src/router.tsx'), 'utf8'),
    check: (src) => {
      const usesSetup = /setupRouterSsrQueryIntegration\s*\(/.test(src)
      // Only assert when Query is installed. (Pre-Query forks of the template would fail this otherwise.)
      const queryInstalled = existsSync(join(REPO_ROOT, 'node_modules/@tanstack/react-query'))
      if (!queryInstalled) return null
      return usesSetup
        ? null
        : {
            severity: 'error',
            message:
              'TanStack Query is installed but src/router.tsx does not call `setupRouterSsrQueryIntegration({ router, queryClient })`. SSR dehydrate/hydrate will not work without it.',
          }
    },
  },
]

export async function runTanstackAudit(): Promise<AuditResult> {
  const findings: Finding[] = []
  for (const c of checks) {
    let source: string | null
    try {
      source = c.source()
    } catch {
      // Skipped; the file doesn't exist or isn't readable.
      continue
    }
    if (source == null) continue
    const result = c.check(source)
    if (result) findings.push({ audit: 'tanstack', file: c.file, ...result })
  }
  return { audit: 'tanstack', findings, ok: true }
}
