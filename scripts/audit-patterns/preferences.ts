// Architectural-seam guards. See ADR-009. Preferences (TanStack
// Query vs swr, Zod vs Yup, etc.) live in AGENTS.md and are caught
// by the `pnpm add` permission gate, not by this audit.

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { REPO_ROOT, repoPath, walkTs } from './_fs'
import type { AuditResult, Finding } from './types'

const AUDIT = 'preferences' as const

interface Rule {
  id: string
  pattern: RegExp
  message: string
  allowedPaths?: string[]
}

const rules: Rule[] = [
  {
    id: 'no-radix-ui',
    pattern: /from\s+['"]radix-ui['"]/,
    message:
      'The template uses Base UI primitives (style: base-vega), not Radix. Run `npx shadcn@latest add <name>`. See ADR-008.',
  },
  {
    id: 'no-radix-ui-scoped',
    pattern: /from\s+['"]@radix-ui\//,
    message: 'The template uses Base UI primitives (style: base-vega), not Radix. See ADR-008.',
  },
  {
    id: 'auth-provider-direct-import',
    pattern:
      /from\s+['"](?:better-auth|next-auth|@auth\/core|@clerk\/[\w-]+|@workos-inc\/[\w-]+|@auth0\/[\w-]+|lucia|iron-session)['"]/,
    message:
      "Don't import auth providers directly outside src/lib/auth/. App code reads identity via `getCurrentUser(request)`. See ADR-005.",
    allowedPaths: ['src/lib/auth/'],
  },
  {
    id: 'no-wrangler-config-flag',
    pattern: /WRANGLER_CONFIG\s*[=:]\s*["']wrangler\.production\.jsonc["']/,
    message:
      'WRANGLER_CONFIG-based env selection is the old pattern. Use a single wrangler.jsonc with env.production block + CLOUDFLARE_ENV. See ADR-001.',
  },
  {
    id: 'no-direct-console',
    pattern: /\bconsole\.(error|warn|info|log|debug)\(/,
    message:
      'Use logInfo/logWarn/logError from @/lib/log instead of console.* directly. Monitoring recipes overlay the wrapper.',
    allowedPaths: ['src/lib/log.ts', 'scripts/'],
  },
]

export function runPreferencesAudit(): AuditResult {
  const findings: Finding[] = []
  const files = [...walkTs(repoPath('src')), ...walkTs(repoPath('scripts'))]

  for (const file of files) {
    const rel = relative(REPO_ROOT, file)
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
