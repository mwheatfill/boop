import { describe, expect, it } from 'vitest'
import { lintLiquidSource } from './liquid-lint'

describe('lintLiquidSource', () => {
  it('returns no diagnostics for an empty template', () => {
    expect(lintLiquidSource('')).toEqual([])
  })

  it('returns no diagnostics for a valid template', () => {
    expect(lintLiquidSource('Hello {{ workspace_name }}')).toEqual([])
  })

  it('returns no diagnostics for a well-formed if/endif block', () => {
    expect(lintLiquidSource('{% if x %}a{% endif %}')).toEqual([])
  })

  it('flags an unclosed tag with a from/to range inside the source', () => {
    const src = '{% if no_endif'
    const [d] = lintLiquidSource(src)
    expect(d).toBeDefined()
    if (!d) return
    expect(d.severity).toBe('error')
    expect(d.from).toBeGreaterThanOrEqual(0)
    expect(d.to).toBeGreaterThan(d.from)
    expect(d.to).toBeLessThanOrEqual(src.length)
    expect(d.message).toMatch(/not closed/i)
    expect(d.message).not.toMatch(/line:\d+/)
  })

  it('flags an unknown tag', () => {
    const [d] = lintLiquidSource('{% bogus_tag %}')
    expect(d).toBeDefined()
    if (!d) return
    expect(d.severity).toBe('error')
    expect(d.message).toMatch(/bogus_tag/)
  })

  it('flags an unclosed output expression', () => {
    const [d] = lintLiquidSource('{{ unclosed')
    expect(d).toBeDefined()
    expect(d?.severity).toBe('error')
  })
})
