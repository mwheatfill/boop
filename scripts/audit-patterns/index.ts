#!/usr/bin/env tsx
// Audit-patterns runner. See ADR-009 for the rationale.

import { writeFileSync } from 'node:fs'
import { runPreferencesAudit } from './preferences'
import { runShadcnAudit } from './shadcn'
import { runTanstackAudit } from './tanstack'
import type { AuditResult, Finding, Severity } from './types'
import { runWorkflowsAudit } from './workflows'

const args = new Set(process.argv.slice(2))
const quiet = args.has('--quiet')

interface Summary {
  errors: number
  warns: number
  failed: boolean
}

function severityIcon(s: Severity): string {
  return s === 'error' ? '✗' : '⚠'
}

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function summarize(results: AuditResult[]): Summary {
  const all = results.flatMap((r) => r.findings)
  const errors = all.filter((f) => f.severity === 'error').length
  const warns = all.filter((f) => f.severity === 'warn').length
  const failed = errors > 0 || results.some((r) => !r.ok)
  return { errors, warns, failed }
}

function renderMarkdown(results: AuditResult[], summary: Summary): string {
  const lines = [
    '# Audit patterns report',
    '',
    `- Errors: ${summary.errors}`,
    `- Warnings: ${summary.warns}`,
    '',
  ]
  for (const result of results) {
    lines.push(`## ${result.audit}`, '')
    if (!result.ok) {
      lines.push(`> Audit failed to run: ${result.error}`, '')
      continue
    }
    if (result.findings.length === 0) {
      lines.push('No drift detected.', '')
      continue
    }
    for (const f of result.findings) {
      const loc = f.line ? `\`${f.file}:${f.line}\`` : `\`${f.file}\``
      lines.push(`- ${severityIcon(f.severity)} **${loc}**: ${f.message}`)
      if (f.source) lines.push(`  - Source: ${f.source}`)
    }
    lines.push('')
  }
  lines.push(
    '---',
    '',
    'Audit-patterns is a structural backstop for architectural seams (auth, logging, primitives, CI config) and canonical-pattern drift (shadcn registry, TanStack Intent skills). See ADR-009.',
  )
  return lines.join('\n')
}

function renderFinding(f: Finding): string {
  const loc = f.line ? `${f.file}:${f.line}` : f.file
  const src = f.source ? `\n     source: ${f.source}` : ''
  return `  ${severityIcon(f.severity)} [${f.audit}] ${loc}\n     ${f.message}${src}`
}

function renderText(results: AuditResult[], summary: Summary): string {
  const lines = ['▶ audit:patterns']
  for (const result of results) {
    lines.push('', `  ${result.audit}:`)
    if (!result.ok) {
      lines.push(`    ✗ audit error: ${result.error}`)
      continue
    }
    if (result.findings.length === 0) {
      lines.push('    ✓ clean')
      continue
    }
    for (const f of result.findings) lines.push(renderFinding(f))
  }
  lines.push(
    '',
    summary.failed
      ? `✗ audit:patterns FAILED (${pluralize(summary.errors, 'error')}, ${pluralize(summary.warns, 'warning')})`
      : `✓ audit:patterns clean (${pluralize(summary.warns, 'warning')})`,
  )
  return lines.join('\n')
}

async function main() {
  // shadcn + workflows hit the network; tanstack + preferences are sync.
  // Promise.all with a mixed list resolves the sync values inline.
  const results = await Promise.all([
    runShadcnAudit(),
    runTanstackAudit(),
    runPreferencesAudit(),
    runWorkflowsAudit(),
  ])
  const summary = summarize(results)

  if (!quiet) console.log(renderText(results, summary))
  writeFileSync('audit-report.md', renderMarkdown(results, summary), 'utf8')
  process.exit(summary.failed ? 1 : 0)
}

main().catch((err) => {
  console.error('audit:patterns runner crashed:', err)
  process.exit(2)
})
