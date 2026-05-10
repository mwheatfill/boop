// TanStack pattern audit. Structural assertions for the canonical
// patterns the version-locked Intent skills declare. Add a check here
// whenever an agent is caught producing a canonical-deviation pattern;
// each finding cites the source SKILL so a reviewer can dig in.

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { REPO_ROOT, readRepoFile, repoPath, walkTs } from './_fs'
import type { AuditResult, Finding } from './types'

const AUDIT = 'tanstack' as const

type CheckResult = Omit<Finding, 'audit' | 'file'> | null

/**
 * A check that scans one fixed file. Skips silently if the file is
 * missing (so the audit gracefully handles forks that delete pieces).
 */
interface SingleFileCheck {
  kind: 'single'
  name: string
  file: string
  check: (source: string) => CheckResult
}

/**
 * A check that scans every TypeScript file under `dir`. Findings carry
 * the actual file path that matched (and a 1-based line number when
 * `check` returns one).
 */
interface MultiFileCheck {
  kind: 'multi'
  name: string
  dir: string
  check: (source: string) => (CheckResult & { line?: number }) | null
}

type Check = SingleFileCheck | MultiFileCheck

const checks: Check[] = [
  {
    kind: 'single',
    name: 'tsconfig.verbatimModuleSyntax-disabled',
    file: 'tsconfig.json',
    check: (src) =>
      /"verbatimModuleSyntax"\s*:\s*true/.test(src)
        ? {
            severity: 'error',
            message:
              '`verbatimModuleSyntax: true` causes server bundles to leak into client bundles. Drop it. See @tanstack/react-start/skills/react-start/SKILL.md (HIGH severity).',
            source: 'react-start SKILL.md',
          }
        : null,
  },
  {
    kind: 'single',
    name: 'root-route-uses-with-context',
    file: 'src/routes/__root.tsx',
    check: (src) =>
      /createRootRoute\s*\(/.test(src) && !/createRootRouteWithContext/.test(src)
        ? {
            severity: 'error',
            message:
              'Use `createRootRouteWithContext<MyRouterContext>()` instead of bare `createRootRoute`. Recipes that need context (auth, query, db) require the typed factory.',
            source: 'TanStack Router data-loading skill',
          }
        : null,
  },
  {
    kind: 'single',
    name: 'router-context-shape-exists',
    file: 'src/router-context.ts',
    check: (src) =>
      /interface\s+MyRouterContext\b/.test(src)
        ? null
        : {
            severity: 'error',
            message:
              'src/router-context.ts must export `interface MyRouterContext` (the module-augmentation seam recipes extend). A type alias would not merge.',
          },
  },
  {
    kind: 'multi',
    name: 'no-no-op-input-validators',
    dir: 'src/routes',
    check: (src) => {
      // Catches `.inputValidator((d) => d)` and `.inputValidator((data) => data)`.
      const lines = src.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (/\.inputValidator\s*\(\s*\(\s*(\w+)\s*\)\s*=>\s*\1\s*\)/.test(lines[i] ?? '')) {
          return {
            severity: 'error',
            line: i + 1,
            message:
              'No-op `.inputValidator((d) => d)` is a pass-through. Real validation must call `schema.parse(data)`. See ADR-013.',
          }
        }
      }
      return null
    },
  },
  {
    kind: 'single',
    name: 'vite-config-uses-tsconfig-paths-plugin',
    file: 'vite.config.ts',
    check: (src) => {
      if (/resolve\s*:\s*\{[^}]*tsconfigPaths\s*:\s*true/.test(src)) {
        return {
          severity: 'error',
          message:
            '`resolve.tsconfigPaths: true` is not a Vite option. Use the `vite-tsconfig-paths` plugin instead.',
        }
      }
      if (!/from\s+['"]vite-tsconfig-paths['"]/.test(src)) {
        return {
          severity: 'warn',
          message:
            'vite.config.ts does not import vite-tsconfig-paths. The plugin is the documented Vite-canonical mechanism for tsconfig path aliases.',
        }
      }
      return null
    },
  },
  {
    kind: 'single',
    name: 'router-has-ssr-query-integration',
    file: 'src/router.tsx',
    check: (src) => {
      const queryInstalled = readRepoFile('node_modules/@tanstack/react-query/package.json') != null
      if (!queryInstalled) return null
      return /setupRouterSsrQueryIntegration\s*\(/.test(src)
        ? null
        : {
            severity: 'error',
            message:
              'TanStack Query is installed but src/router.tsx does not call `setupRouterSsrQueryIntegration({ router, queryClient })`. SSR dehydrate/hydrate will not work without it.',
          }
    },
  },
]

function runCheck(c: Check): Finding[] {
  if (c.kind === 'single') {
    const src = readRepoFile(c.file)
    if (src == null) return []
    const result = c.check(src)
    return result ? [{ audit: AUDIT, file: c.file, ...result }] : []
  }
  const findings: Finding[] = []
  for (const abs of walkTs(repoPath(c.dir))) {
    const result = c.check(readFileSync(abs, 'utf8'))
    if (result) {
      findings.push({ audit: AUDIT, file: relative(REPO_ROOT, abs), ...result })
    }
  }
  return findings
}

export function runTanstackAudit(): AuditResult {
  return {
    audit: AUDIT,
    findings: checks.flatMap(runCheck),
    ok: true,
  }
}
