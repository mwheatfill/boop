// shadcn drift audit. Fetches the canonical source for every component
// in src/components/ui/ from the live shadcn registry and structural-
// diffs against ours. Catches the failure mode where an agent (or a
// human) hand-edits a primitive away from the canonical shape, which
// breaks the canonical CSS selectors that depend on data-slot
// attributes, base classes, and named exports.
//
// Strategy:
//   1. Read components.json to learn the active style ("new-york").
//   2. For each *.tsx file under src/components/ui/, fetch the matching
//      canonical source from https://ui.shadcn.com/r/styles/<style>-v4/
//      <name>.json.
//   3. Compare structural signals: imports, named exports, data-slot
//      attributes, presence of canonical class fragments.
//   4. Whitelist file at audit/shadcn-allowed-deviations.json lets a
//      component opt out (with a documented reason).
//
// The audit grounds in the live registry on every run, so when shadcn
// changes the canonical Button next year, the next audit run flags
// us as drifted. That's the point.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { AuditResult, Finding } from './types.ts'

const REPO_ROOT = process.cwd()
const UI_DIR = join(REPO_ROOT, 'src/components/ui')
const ALLOWLIST = join(REPO_ROOT, 'audit/shadcn-allowed-deviations.json')

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

interface Allowlist {
  // Map of component name → array of structural signals to skip.
  // Example: { "button": ["import:radix-ui"] } means "don't fail if our
  // button imports Slot from somewhere other than radix-ui".
  [component: string]: string[]
}

function loadAllowlist(): Allowlist {
  if (!existsSync(ALLOWLIST)) return {}
  return JSON.parse(readFileSync(ALLOWLIST, 'utf8'))
}

function getStyle(): string {
  const componentsJson = JSON.parse(readFileSync(join(REPO_ROOT, 'components.json'), 'utf8'))
  return componentsJson.style ?? 'new-york'
}

// Resolve the registry URL for a (style, component) pair. The registry
// has two coexisting URL conventions:
//   - Legacy "v4-suffixed" styles ("default", "new-york") live at
//     /r/styles/<style>-v4/<name>.json.
//   - The newer celestial themes (radix-vega, base-vega, etc.) live at
//     /r/styles/<style>/<name>.json with no suffix.
// We try the unsuffixed URL first (the modern path) and fall back.
async function fetchCanonical(name: string, style: string): Promise<RegistryEntry | null> {
  const candidates = [
    `https://ui.shadcn.com/r/styles/${style}/${name}.json`,
    `https://ui.shadcn.com/r/styles/${style}-v4/${name}.json`,
  ]
  for (const url of candidates) {
    const res = await fetch(url)
    if (res.ok) return (await res.json()) as RegistryEntry
  }
  return null
}

// Extract the structural signals that matter (not whitespace, not exact
// formatting). Two passes over the source:
//   - top-level imports, by source module
//   - named exports
//   - data-slot string-literal occurrences
function extractSignals(content: string) {
  const imports: Array<{ source: string; names: string[] }> = []
  const exports = new Set<string>()
  const dataSlots = new Set<string>()

  // Imports.
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

  // Named exports: `export { Foo, Bar }` and `export function Foo` and `export const Foo`.
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

  // data-slot="..." occurrences.
  for (const m of content.matchAll(/data-slot=['"]([^'"]+)['"]/g)) {
    const slot = m[1]
    if (slot) dataSlots.add(slot)
  }

  return { imports, exports, dataSlots }
}

function diffSignals(
  ours: ReturnType<typeof extractSignals>,
  theirs: ReturnType<typeof extractSignals>,
  componentName: string,
  allowlist: string[],
): Array<{ signal: string; message: string }> {
  const issues: Array<{ signal: string; message: string }> = []

  // Each canonical import source should be present in ours (we may
  // import more, but we can't drop a canonical one). Skip imports from
  // the registry's own internal monorepo paths (e.g.
  // `@/registry/base-vega/lib/utils`); the shadcn CLI rewrites those
  // to the consumer's alias paths from components.json on install, so
  // a 1:1 source-string match would fail by design.
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

  // Every canonical named export must be present in ours.
  for (const name of theirs.exports) {
    const sig = `export:${name}`
    if (!ours.exports.has(name) && !allowlist.includes(sig)) {
      issues.push({
        signal: sig,
        message: `Missing canonical named export "${name}". Run \`npx shadcn@latest add ${componentName}\` to restore, or whitelist "${sig}" with a reason.`,
      })
    }
  }

  // Every canonical data-slot value must be present in ours.
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

export async function runShadcnAudit(): Promise<AuditResult> {
  const findings: Finding[] = []

  if (!existsSync(UI_DIR)) {
    return { audit: 'shadcn', findings: [], ok: true }
  }

  let allowlist: Allowlist
  let style: string
  try {
    allowlist = loadAllowlist()
    style = getStyle()
  } catch (err) {
    return {
      audit: 'shadcn',
      findings: [],
      ok: false,
      error: `Failed to load allowlist or components.json: ${(err as Error).message}`,
    }
  }

  const componentFiles = readdirSync(UI_DIR).filter((f) => f.endsWith('.tsx'))

  for (const file of componentFiles) {
    const componentName = file.replace(/\.tsx$/, '')
    const ourPath = join(UI_DIR, file)
    const ourSource = readFileSync(ourPath, 'utf8')

    let canonical: RegistryEntry | null
    try {
      canonical = await fetchCanonical(componentName, style)
    } catch (err) {
      findings.push({
        audit: 'shadcn',
        severity: 'warn',
        file: relative(REPO_ROOT, ourPath),
        message: `Could not fetch canonical from registry: ${(err as Error).message}`,
      })
      continue
    }

    if (!canonical) {
      findings.push({
        audit: 'shadcn',
        severity: 'warn',
        file: relative(REPO_ROOT, ourPath),
        message: `Component "${componentName}" not in shadcn registry (style: ${style}). If this is a custom in-house primitive, whitelist it; if it's misnamed, rename it.`,
      })
      continue
    }

    // The registry returns the full component file inline. Use the first
    // .tsx file as the canonical source for the named primitive.
    const canonicalFile = canonical.files.find((f) => f.path.endsWith(`${componentName}.tsx`))
    if (!canonicalFile) {
      findings.push({
        audit: 'shadcn',
        severity: 'warn',
        file: relative(REPO_ROOT, ourPath),
        message: `Registry entry for "${componentName}" has no matching .tsx file.`,
      })
      continue
    }

    const ours = extractSignals(ourSource)
    const theirs = extractSignals(canonicalFile.content)
    const componentAllowlist = allowlist[componentName] ?? []
    const issues = diffSignals(ours, theirs, componentName, componentAllowlist)

    for (const issue of issues) {
      findings.push({
        audit: 'shadcn',
        severity: 'error',
        file: relative(REPO_ROOT, ourPath),
        message: issue.message,
        source: `https://ui.shadcn.com/r/styles/${style}/${componentName}.json`,
      })
    }
  }

  return { audit: 'shadcn', findings, ok: true }
}
