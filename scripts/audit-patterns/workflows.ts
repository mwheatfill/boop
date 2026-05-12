// Stale-pin guard for GitHub Actions in .github/workflows and
// .github/actions. Errors when a pinned major is behind the action's
// latest GitHub release; warns when a pin uses a moving ref (branch
// name) or a shape this audit cannot recognize. SHA-pinned actions
// are trusted to Renovate's helpers:pinGitHubActionDigests preset.
// See ADR-020.

import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { REPO_ROOT, readRepoFile, repoPath } from './_fs'
import type { AuditResult, Finding } from './types'

const AUDIT = 'workflows' as const
const FETCH_TIMEOUT_MS = 10_000

interface Pin {
  file: string
  line: number
  owner: string
  repo: string
  ref: string
}

interface RefShape {
  kind: 'major' | 'sha' | 'branch' | 'other'
  major?: number
}

function listYamlFiles(): string[] {
  const out: string[] = []
  const workflowsDir = repoPath('.github/workflows')
  if (existsSafe(workflowsDir)) {
    for (const name of readdirSync(workflowsDir)) {
      if (/\.ya?ml$/.test(name)) out.push(join(workflowsDir, name))
    }
  }
  const actionsDir = repoPath('.github/actions')
  if (existsSafe(actionsDir)) walk(actionsDir, out)
  return out
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.ya?ml$/.test(name)) out.push(p)
  }
}

function existsSafe(p: string): boolean {
  try {
    statSync(p)
    return true
  } catch {
    return false
  }
}

// `uses: <owner>/<repo>(/<sub-path>)?@<ref>` — captures owner, repo, ref.
// Skips local (`./...`) and docker (`docker://...`) references.
const USES_RE = /^\s*(?:-\s+)?uses:\s+([^./\s@]+)\/([^@/\s]+)(?:\/[^@\s]+)?@(\S+)\s*$/

function parsePins(): Pin[] {
  const pins: Pin[] = []
  for (const file of listYamlFiles()) {
    const text = readRepoFile(relative(REPO_ROOT, file))
    if (text == null) continue
    text.split('\n').forEach((line, idx) => {
      const m = line.match(USES_RE)
      if (!m) return
      const [, owner, repo, ref] = m
      if (!owner || !repo || !ref) return
      pins.push({ file: relative(REPO_ROOT, file), line: idx + 1, owner, repo, ref })
    })
  }
  return pins
}

function classifyRef(ref: string): RefShape {
  const tag = ref.match(/^v?(\d+)(?:\.\d+)*$/)
  if (tag?.[1]) return { kind: 'major', major: Number(tag[1]) }
  if (/^[0-9a-f]{40}$/i.test(ref)) return { kind: 'sha' }
  if (/^(main|master|develop|dev|trunk|release)$/i.test(ref)) return { kind: 'branch' }
  return { kind: 'other' }
}

interface ReleaseInfo {
  latestMajor: number | null
  error?: string
}

async function fetchLatestMajor(owner: string, repo: string): Promise<ReleaseInfo> {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'boop-audit-patterns',
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (res.status === 404) return { latestMajor: null, error: 'no releases on GitHub' }
    if (!res.ok) return { latestMajor: null, error: `${res.status} ${res.statusText}` }
    const data = (await res.json()) as { tag_name?: string }
    const tag = data.tag_name ?? ''
    const m = tag.match(/^v?(\d+)/)
    if (!m?.[1]) return { latestMajor: null, error: `unparseable tag ${tag}` }
    return { latestMajor: Number(m[1]) }
  } catch (err) {
    return { latestMajor: null, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function runWorkflowsAudit(): Promise<AuditResult> {
  const pins = parsePins()
  if (pins.length === 0) return { audit: AUDIT, findings: [], ok: true }

  const groups = new Map<string, Pin[]>()
  for (const p of pins) {
    const key = `${p.owner}/${p.repo}`
    const list = groups.get(key) ?? []
    list.push(p)
    groups.set(key, list)
  }

  const latests = new Map<string, ReleaseInfo>()
  await Promise.all(
    [...groups.keys()].map(async (key) => {
      const [owner, repo] = key.split('/')
      if (!owner || !repo) return
      latests.set(key, await fetchLatestMajor(owner, repo))
    }),
  )

  const findings: Finding[] = []
  for (const pin of pins) {
    const shape = classifyRef(pin.ref)
    const key = `${pin.owner}/${pin.repo}`
    const releasesUrl = `https://github.com/${pin.owner}/${pin.repo}/releases`

    if (shape.kind === 'sha') {
      // SHA-pinned; Renovate keeps the digest fresh via helpers:pinGitHubActionDigests.
      continue
    }
    if (shape.kind === 'branch') {
      findings.push({
        audit: AUDIT,
        severity: 'warn',
        file: pin.file,
        line: pin.line,
        message: `Pins ${key}@${pin.ref} to a moving branch ref. Repin to a tagged major or a SHA.`,
        source: releasesUrl,
      })
      continue
    }
    if (shape.kind === 'other') {
      findings.push({
        audit: AUDIT,
        severity: 'warn',
        file: pin.file,
        line: pin.line,
        message: `Pin ${key}@${pin.ref} does not match a recognized major-tag or SHA shape. Use vN, vN.M, vN.M.K, or a 40-char SHA.`,
        source: releasesUrl,
      })
      continue
    }

    const latest = latests.get(key)
    if (!latest || latest.latestMajor == null) {
      findings.push({
        audit: AUDIT,
        severity: 'warn',
        file: pin.file,
        line: pin.line,
        message: `Could not resolve latest release for ${key}: ${latest?.error ?? 'unknown error'}. Verify manually.`,
        source: releasesUrl,
      })
      continue
    }
    if (shape.major != null && shape.major < latest.latestMajor) {
      findings.push({
        audit: AUDIT,
        severity: 'error',
        file: pin.file,
        line: pin.line,
        message: `${key}@${pin.ref} is behind latest major v${latest.latestMajor}. Bump the pin or SHA-pin with Renovate's helpers:pinGitHubActionDigests preset. See ADR-020.`,
        source: releasesUrl,
      })
    }
  }

  return { audit: AUDIT, findings, ok: true }
}
