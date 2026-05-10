// shadcn drift audit: structural-diff every src/components/ui/*.tsx
// against the live shadcn registry. The audit refetches on every run so
// that when shadcn changes a canonical primitive, the next run flags
// us automatically.

import { readdirSync } from 'node:fs'
import { relative } from 'node:path'
import { REPO_ROOT, readJson, readRepoFile, repoPath } from './_fs'
import type { AuditResult, Finding } from './types'

const AUDIT = 'shadcn' as const
const UI_DIR = repoPath('src/components/ui')
const ALLOWLIST = 'audit/shadcn-allowed-deviations.json'

interface RegistryFile {
  path: string
  content: string
  type: string
}
interface RegistryEntry {
  name: string
  files: RegistryFile[]
  dependencies?: string[]
}

/**
 * Per-component allowlist of structural signals to skip. Pattern:
 *   { "<component>": ["import:<source>" | "export:<name>" | "data-slot:<value>"] }
 * Only use for documented intentional deviations from canonical.
 */
type Allowlist = Record<string, string[]>

function getStyle(): string {
  const componentsJson = readJson<{ style?: string }>('components.json', {})
  return componentsJson.style ?? 'new-york'
}

// Two coexisting URL conventions in the registry:
//   - Legacy "v4-suffixed" styles ("default", "new-york") at /r/styles/<style>-v4/<name>.json
//   - Newer celestial themes (radix-vega, base-vega, etc.) at /r/styles/<style>/<name>.json (no suffix)
// Try unsuffixed first; fall back. Per-URL try/catch so a transient
// network error on one URL doesn't skip the fallback.
async function fetchCanonical(name: string, style: string): Promise<RegistryEntry | null> {
  const candidates = [
    `https://ui.shadcn.com/r/styles/${style}/${name}.json`,
    `https://ui.shadcn.com/r/styles/${style}-v4/${name}.json`,
  ]
  for (const url of candidates) {
    try {
      const res = await fetch(url)
      if (res.ok) return (await res.json()) as RegistryEntry
    } catch {
      // try next candidate
    }
  }
  return null
}

interface Signals {
  imports: Array<{ source: string; names: string[] }>
  exports: Set<string>
  dataSlots: Set<string>
}

function extractSignals(content: string): Signals {
  const imports: Signals['imports'] = []
  const exports = new Set<string>()
  const dataSlots = new Set<string>()

  const importRe =
    /import\s+(?:type\s+)?(\{[^}]*\}|\*\s+as\s+\w+|\w+)?\s*(?:,\s*(\{[^}]*\}))?\s*from\s+['"]([^'"]+)['"]/g
  for (const m of content.matchAll(importRe)) {
    const source = m[3]
    const namedClause = m[1]?.startsWith('{') ? m[1] : m[2]
    const names: string[] = namedClause
      ? namedClause
          .replace(/[{}]/g, '')
          .split(',')
          .map((s) => s.trim().split(/\s+as\s+/)[0] ?? '')
          .filter((n): n is string => n.length > 0)
      : []
    if (source) imports.push({ source, names })
  }

  for (const m of content.matchAll(/export\s+\{([^}]+)\}/g)) {
    const inner = m[1]
    if (!inner) continue
    for (const name of inner.split(',')) {
      const cleaned = name.trim().split(/\s+as\s+/)[0]
      if (cleaned) exports.add(cleaned)
    }
  }
  for (const m of content.matchAll(/export\s+(?:function|const|class|interface|type)\s+(\w+)/g)) {
    const name = m[1]
    if (name) exports.add(name)
  }

  for (const m of content.matchAll(/data-slot=['"]([^'"]+)['"]/g)) {
    const slot = m[1]
    if (slot) dataSlots.add(slot)
  }

  return { imports, exports, dataSlots }
}

function diffSignals(
  ours: Signals,
  theirs: Signals,
  componentName: string,
  allowlist: string[],
): Array<{ signal: string; message: string }> {
  const issues: Array<{ signal: string; message: string }> = []

  // Internal monorepo paths like `@/registry/base-vega/lib/utils` get
  // rewritten by the CLI to consumer aliases (e.g. `@/lib/utils`) on
  // install — diffing them as raw strings would always fail. Skip.
  const ourSources = new Set(ours.imports.map((i) => i.source))
  for (const imp of theirs.imports) {
    if (imp.source.startsWith('@/registry/')) continue
    const sig = `import:${imp.source}`
    if (!ourSources.has(imp.source) && !allowlist.includes(sig)) {
      issues.push({
        signal: sig,
        message: `Missing canonical import from "${imp.source}". Either add it back or whitelist "${sig}" in audit/shadcn-allowed-deviations.json with a reason.`,
      })
    }
  }

  for (const name of theirs.exports) {
    const sig = `export:${name}`
    if (!ours.exports.has(name) && !allowlist.includes(sig)) {
      issues.push({
        signal: sig,
        message: `Missing canonical named export "${name}". Run \`npx shadcn@latest add ${componentName}\` to restore, or whitelist "${sig}" with a reason.`,
      })
    }
  }

  for (const slot of theirs.dataSlots) {
    const sig = `data-slot:${slot}`
    if (!ours.dataSlots.has(slot) && !allowlist.includes(sig)) {
      issues.push({
        signal: sig,
        message: `Missing canonical \`data-slot="${slot}"\` attribute. Canonical CSS selectors depend on it; restore or whitelist "${sig}".`,
      })
    }
  }

  return issues
}

async function auditComponent(
  file: string,
  style: string,
  allowlist: Allowlist,
): Promise<Finding[]> {
  const componentName = file.replace(/\.tsx$/, '')
  const ourRel = relative(REPO_ROOT, `${UI_DIR}/${file}`)
  const ourSource = readRepoFile(`src/components/ui/${file}`)
  if (ourSource == null) return []

  const canonical = await fetchCanonical(componentName, style)
  if (!canonical) {
    return [
      {
        audit: AUDIT,
        severity: 'warn',
        file: ourRel,
        message: `Component "${componentName}" not in shadcn registry (style: ${style}). If this is a custom in-house primitive, whitelist it; if it's misnamed, rename it.`,
      },
    ]
  }

  const canonicalFile = canonical.files.find((f) => f.path.endsWith(`${componentName}.tsx`))
  if (!canonicalFile) {
    return [
      {
        audit: AUDIT,
        severity: 'warn',
        file: ourRel,
        message: `Registry entry for "${componentName}" has no matching .tsx file.`,
      },
    ]
  }

  const issues = diffSignals(
    extractSignals(ourSource),
    extractSignals(canonicalFile.content),
    componentName,
    allowlist[componentName] ?? [],
  )
  return issues.map((issue) => ({
    audit: AUDIT,
    severity: 'error',
    file: ourRel,
    message: issue.message,
    source: `https://ui.shadcn.com/r/styles/${style}/${componentName}.json`,
  }))
}

export async function runShadcnAudit(): Promise<AuditResult> {
  let componentFiles: string[]
  try {
    componentFiles = readdirSync(UI_DIR).filter((f) => f.endsWith('.tsx'))
  } catch {
    return { audit: AUDIT, findings: [], ok: true }
  }

  const style = getStyle()
  const allowlist = readJson<Allowlist>(ALLOWLIST, {})

  const findingGroups = await Promise.all(
    componentFiles.map((file) => auditComponent(file, style, allowlist)),
  )
  return { audit: AUDIT, findings: findingGroups.flat(), ok: true }
}
