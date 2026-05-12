import { describe, expect, it } from 'vitest'
import { createPrng } from './prng'

describe('createPrng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createPrng('alpha')
    const b = createPrng('alpha')
    for (let i = 0; i < 50; i++) {
      expect(a.next()).toBe(b.next())
    }
  })

  it('produces different sequences for different seeds', () => {
    const a = createPrng('alpha')
    const b = createPrng('beta')
    const sa = Array.from({ length: 50 }, () => a.next())
    const sb = Array.from({ length: 50 }, () => b.next())
    expect(sa).not.toEqual(sb)
  })

  it('distributes booleans roughly to the requested probability', () => {
    const rng = createPrng('bool-test')
    let hits = 0
    const N = 10_000
    for (let i = 0; i < N; i++) {
      if (rng.bool(0.3)) hits++
    }
    expect(hits / N).toBeGreaterThan(0.27)
    expect(hits / N).toBeLessThan(0.33)
  })

  it('fork derives a new deterministic stream from a label', () => {
    const a1 = createPrng('alpha').fork('x')
    const a2 = createPrng('alpha').fork('x')
    expect(a1.next()).toBe(a2.next())
    const b = createPrng('alpha').fork('y')
    expect(a1.next()).not.toBe(b.next())
  })

  it('int returns inclusive bounds and rejects max<min', () => {
    const rng = createPrng('int-test')
    for (let i = 0; i < 100; i++) {
      const n = rng.int(5, 10)
      expect(n).toBeGreaterThanOrEqual(5)
      expect(n).toBeLessThanOrEqual(10)
    }
    expect(() => rng.int(10, 5)).toThrow()
  })
})
