import { createHash } from 'node:crypto'

export type Prng = {
  next: () => number
  int: (min: number, max: number) => number
  pick: <T>(items: readonly T[]) => T
  bool: (probability: number) => boolean
  fork: (label: string) => Prng
}

export function createPrng(seed: string): Prng {
  let state = hashSeed(seed)

  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }

  const int = (min: number, max: number): number => {
    if (max < min) throw new Error(`prng.int: max (${max}) < min (${min})`)
    return min + Math.floor(next() * (max - min + 1))
  }

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error('prng.pick: empty array')
    return items[Math.floor(next() * items.length)] as T
  }

  const bool = (probability: number): boolean => next() < probability

  const fork = (label: string): Prng => createPrng(`${seed}:${label}`)

  return { next, int, pick, bool, fork }
}

function hashSeed(seed: string): number {
  const digest = createHash('sha256').update(seed).digest()
  return digest.readUInt32BE(0)
}
