import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEntityDefault } from './use-entity-default'

interface Item {
  id: string
}

const a: Item = { id: 'a' }
const b: Item = { id: 'b' }
const c: Item = { id: 'c' }

function Harness({
  result,
  urlSourceValue,
  lastUsedValue,
  fallbackChain,
}: {
  result: { current: Item | null }
  urlSourceValue?: Item | null
  lastUsedValue?: Item | null
  fallbackChain?: ReadonlyArray<Item | null | undefined>
}) {
  result.current = useEntityDefault<Item>({
    ...(urlSourceValue !== undefined ? { urlSourceValue } : {}),
    ...(lastUsedValue !== undefined ? { lastUsedValue } : {}),
    ...(fallbackChain ? { fallbackChain } : {}),
  })
  return null
}

describe('useEntityDefault', () => {
  it('urlSourceValue wins over everything', () => {
    const result: { current: Item | null } = { current: null }
    render(<Harness result={result} urlSourceValue={a} lastUsedValue={b} fallbackChain={[c]} />)
    expect(result.current).toBe(a)
  })

  it('lastUsedValue wins over the fallback chain when urlSource is empty', () => {
    const result: { current: Item | null } = { current: null }
    render(<Harness result={result} lastUsedValue={b} fallbackChain={[c]} />)
    expect(result.current).toBe(b)
  })

  it('first non-null fallback wins when prior layers are empty', () => {
    const result: { current: Item | null } = { current: null }
    render(<Harness result={result} fallbackChain={[null, undefined, c]} />)
    expect(result.current).toBe(c)
  })

  it('returns null when every layer is empty', () => {
    const result: { current: Item | null } = { current: null }
    render(<Harness result={result} fallbackChain={[null, undefined]} />)
    expect(result.current).toBeNull()
  })
})
