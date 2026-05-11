// Structural assertions for the canonical patterns the version-locked
// TanStack Intent skills declare.

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { REPO_ROOT, readRepoFile, repoPath, walkTs } from './_fs'
import type { AuditResult, Finding } from './types'

const AUDIT = 'tanstack' as const

type CheckResult = Omit<Finding, 'audit' | 'file'> | null

interface SingleFileCheck {
  kind: 'single'
  name: string
  file: string
  check: (source: string) => CheckResult
}

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
    kind: 'multi',
    name: 'mutating-server-fn-needs-input-validator',
    dir: 'src/routes',
    check: (src) => {
      const re =
        /createServerFn\s*\(\s*\{[^}]*method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"][^}]*\}\s*\)([\s\S]*?)\.handler\s*\(/g
      let m = re.exec(src)
      while (m !== null) {
        const between = m[1] ?? ''
        if (!/\.inputValidator\s*\(/.test(between)) {
          const line = src.slice(0, m.index).split('\n').length
          return {
            severity: 'error',
            line,
            message:
              'Mutating server fn (POST/PUT/PATCH/DELETE) is missing `.inputValidator(...)`. ADR-013 requires validation on every server-fn input.',
          }
        }
        m = re.exec(src)
      }
      return null
    },
  },
  {
    kind: 'single',
    name: 'vite-config-uses-native-tsconfig-paths',
    file: 'vite.config.ts',
    check: (src) => {
      if (/from\s+['"]vite-tsconfig-paths['"]/.test(src)) {
        return {
          severity: 'error',
          message:
            'Remove the `vite-tsconfig-paths` plugin. Vite 8 resolves tsconfig paths natively via `resolve.tsconfigPaths: true` (https://vite.dev/config/shared-options.html#resolve-tsconfigpaths).',
        }
      }
      if (!/resolve\s*:\s*\{[^}]*tsconfigPaths\s*:\s*true/.test(src)) {
        return {
          severity: 'warn',
          message:
            'vite.config.ts does not enable `resolve.tsconfigPaths: true`. Path aliases from tsconfig.json will not resolve at build time.',
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
