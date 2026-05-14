// Mechanical anti-pattern guard for DESIGN.md § 11. See ADR-009 for the
// audit-patterns rationale and ADR-022 for the design system being enforced.
// High-confidence catches only: Tailwind color classes that bypass the theme
// tokens, hardcoded color values inside className strings. Heuristic catches
// (rounded-on-data-surface, shadow-on-non-floating) are deferred until the
// false-positive surface is known.

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { REPO_ROOT, repoPath, walkTs } from './_fs'
import type { AuditResult, Finding } from './types'

const AUDIT = 'design' as const

interface Rule {
  id: string
  pattern: RegExp
  message: string
  allowedPaths?: string[]
  severity: 'error' | 'warn'
}

// Tailwind v4 color names that have numeric scales. Token-based classes
// (text-primary, bg-card, border-muted) do not have a numeric suffix, so
// the `-\d+` anchor on this pattern only matches palette-based classes.
const TW_COLOR_FAMILIES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const TW_COLOR_PREFIXES =
  'text|bg|border|ring|outline|decoration|placeholder|caret|fill|stroke|from|via|to|shadow'

const rules: Rule[] = [
  {
    id: 'no-tailwind-color-numeric',
    pattern: new RegExp(`(?:^|[\\s"'\`])(?:${TW_COLOR_PREFIXES})-(?:${TW_COLOR_FAMILIES})-\\d+`),
    message:
      'Tailwind color classes with numeric scales bypass the theme tokens. Use the token classes (text-primary, bg-card, border-muted, text-success/warning/info/destructive, etc.) so colors flow from --theme-base / --theme-accent. See DESIGN.md § 3 Visual tokens.',
    severity: 'error',
  },
  {
    id: 'no-tailwind-arbitrary-color',
    pattern: new RegExp(
      `(?:^|[\\s"'\`])(?:${TW_COLOR_PREFIXES})-\\[(?:#|rgb|hsl|oklch|var\\(--[^)]*color)`,
    ),
    message:
      'Tailwind arbitrary color values (text-[#abc], bg-[oklch(...)], etc.) bypass the token system. Use a token class. If a token does not yet exist, propose it in DESIGN.md § 3 first. See DESIGN.md § 11 Anti-patterns.',
    severity: 'error',
  },
  {
    id: 'no-hardcoded-color-in-jsx',
    // Look for hex / oklch / rgb / hsl literals in JSX attribute values
    // (className, style, fill, stroke, etc.). Skip imports and CSS-in-TS
    // helpers that should be handling colors through tokens.
    pattern:
      /(?:className|style|fill|stroke|color)\s*[:=]\s*\{?\s*[`"'][\s\S]{0,400}?(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6,8})(?![0-9a-fA-F])|oklch\(|rgb\(|hsl\()/,
    message:
      'Hardcoded color in a JSX attribute bypasses the token system. Move the color to src/styles/app.css and use a token class. See DESIGN.md § 3 + § 11.',
    severity: 'error',
  },
]

export function runDesignAudit(): AuditResult {
  const findings: Finding[] = []
  const files = walkTs(repoPath('src')).filter((f) => /\.tsx?$/.test(f))

  for (const file of files) {
    const rel = relative(REPO_ROOT, file)
    const lines = readFileSync(file, 'utf8').split('\n')

    for (const rule of rules) {
      if (rule.allowedPaths?.some((p) => rel.startsWith(p))) continue
      lines.forEach((line, idx) => {
        if (rule.pattern.test(line)) {
          findings.push({
            audit: AUDIT,
            severity: rule.severity,
            file: rel,
            line: idx + 1,
            message: rule.message,
            source: 'DESIGN.md § 3 Visual tokens, § 11 Anti-patterns',
          })
        }
      })
    }
  }

  return { audit: AUDIT, findings, ok: true }
}
