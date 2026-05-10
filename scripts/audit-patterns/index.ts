#!/usr/bin/env tsx
// Audit-patterns runner. Aggregates the three audits, prints a single
// human-readable report, writes audit-report.md (consumed by the CI
// PR-comment step), and exits non-zero if any audit produced an
// `error`-severity finding.
//
// Usage:
//   pnpm audit:patterns           # human-readable + writes report
//   pnpm audit:patterns --quiet   # just exit code, for CI without report
//
// New audits: add a new file under scripts/audit-patterns/, export a
// `run<Name>Audit(): Promise<AuditResult>`, import + invoke here.

import { writeFileSync } from 'node:fs'
import { runPreferencesAudit } from './preferences.ts'
import { runShadcnAudit } from './shadcn.ts'
import { runTanstackAudit } from './tanstack.ts'
import type { AuditResult, Finding } from './types.ts'

const args = new Set(process.argv.slice(2))
const quiet = args.has('--quiet')

function severityIcon(s: Finding['severity']): string {
  return s === 'error' ? '✗' : '⚠'
}

function formatFinding(f: Finding): string {
  const loc = f.line ? `${f.file}:${f.line}` : f.file
  const src = f.source ? `\n     source: ${f.source}` : ''
  return `  ${severityIcon(f.severity)} [${f.audit}] ${loc}\n     ${f.message}${src}`
}

function formatReport(results: AuditResult[]): { md: string; text: string; failed: boolean } {
  const allFindings = results.flatMap((r) => r.findings)
  const errors = allFindings.filter((f) => f.severity === 'error')
  const warns = allFindings.filter((f) => f.severity === 'warn')
  const failed = errors.length > 0 || results.some((r) => !r.ok)

  // Markdown for PR comment.
  const mdLines: string[] = []
  mdLines.push('# Audit patterns report')
  mdLines.push('')
  mdLines.push(`- Errors: ${errors.length}`)
  mdLines.push(`- Warnings: ${warns.length}`)
  mdLines.push('')
  for (const result of results) {
    mdLines.push(`## ${result.audit}`)
    mdLines.push('')
    if (!result.ok) {
      mdLines.push(`> Audit failed to run: ${result.error}`)
      mdLines.push('')
      continue
    }
    if (result.findings.length === 0) {
      mdLines.push('No drift detected.')
      mdLines.push('')
      continue
    }
    for (const f of result.findings) {
      const loc = f.line ? `\`${f.file}:${f.line}\`` : `\`${f.file}\``
      mdLines.push(`- ${severityIcon(f.severity)} **${loc}**: ${f.message}`)
      if (f.source) mdLines.push(`  - Source: ${f.source}`)
    }
    mdLines.push('')
  }
  mdLines.push('---')
  mdLines.push('')
  mdLines.push(
    'Audit-patterns is the mechanical enforcement of `agent-rules/preferences.md`. See ADR-0011 for the rationale.',
  )

  // Text for terminal.
  const textLines: string[] = []
  textLines.push('▶ audit:patterns')
  for (const result of results) {
    textLines.push('')
    textLines.push(`  ${result.audit}:`)
    if (!result.ok) {
      textLines.push(`    ✗ audit error: ${result.error}`)
      continue
    }
    if (result.findings.length === 0) {
      textLines.push('    ✓ clean')
      continue
    }
    for (const f of result.findings) {
      textLines.push(formatFinding(f))
    }
  }
  textLines.push('')
  textLines.push(
    failed
      ? `✗ audit:patterns FAILED (${errors.length} error${errors.length === 1 ? '' : 's'}, ${warns.length} warning${warns.length === 1 ? '' : 's'})`
      : `✓ audit:patterns clean (${warns.length} warning${warns.length === 1 ? '' : 's'})`,
  )

  return { md: mdLines.join('\n'), text: textLines.join('\n'), failed }
}

async function main() {
  const results = await Promise.all([
    runShadcnAudit(),
    runTanstackAudit(),
    Promise.resolve(runPreferencesAudit()),
  ])

  const { md, text, failed } = formatReport(results)
  if (!quiet) {
    console.log(text)
  }
  writeFileSync('audit-report.md', md, 'utf8')
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error('audit:patterns runner crashed:', err)
  process.exit(2)
})
