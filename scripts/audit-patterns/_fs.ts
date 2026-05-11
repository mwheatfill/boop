import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export function repoPath(rel: string): string {
  return join(REPO_ROOT, rel)
}

export function readRepoFile(rel: string): string | null {
  const p = repoPath(rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

export function readJson<T>(rel: string, fallback: T): T {
  const src = readRepoFile(rel)
  return src == null ? fallback : (JSON.parse(src) as T)
}

export function walkTs(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walkTs(p)
    if (/\.(ts|tsx|mts|cts)$/.test(name)) return [p]
    return []
  })
}
