// Shared filesystem helpers for the audit scripts. Centralizes path
// resolution (REPO_ROOT derived from this file's location, not cwd —
// matches the openapi scripts' pattern, robust to invocation from any
// subdirectory) and the walk + readFile patterns the three audits used
// to each duplicate.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export function repoPath(rel: string): string {
  return join(REPO_ROOT, rel)
}

/** Returns the file's contents, or null if the file doesn't exist. */
export function readRepoFile(rel: string): string | null {
  const p = repoPath(rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

/** Reads + parses JSON. Returns the fallback if the file is missing. */
export function readJson<T>(rel: string, fallback: T): T {
  const src = readRepoFile(rel)
  return src == null ? fallback : (JSON.parse(src) as T)
}

/**
 * Recursively collects TypeScript source paths under `dir` (absolute).
 * Returns absolute paths. Includes .ts, .tsx, .mts, .cts.
 */
export function walkTs(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walkTs(p)
    if (/\.(ts|tsx|mts|cts)$/.test(name)) return [p]
    return []
  })
}
