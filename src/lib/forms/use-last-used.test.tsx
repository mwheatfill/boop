import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type UseLastUsedResult, useLastUsed } from './use-last-used'

interface Item {
  id: string
  name: string
}

const alpha: Item = { id: 'a', name: 'Alpha' }
const bravo: Item = { id: 'b', name: 'Bravo' }
const items: Item[] = [alpha, bravo]

function Harness({
  apiRef,
  items: list,
  storageKey,
}: {
  apiRef: { current: UseLastUsedResult<Item> | null }
  items: Item[]
  storageKey: string
}) {
  apiRef.current = useLastUsed<Item>(storageKey, list, (i) => i.id)
  return null
}

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('useLastUsed', () => {
  it('returns null when nothing is stored', () => {
    const apiRef: { current: UseLastUsedResult<Item> | null } = { current: null }
    render(<Harness apiRef={apiRef} items={items} storageKey="t.last:v1" />)
    expect(apiRef.current?.lastUsed).toBeNull()
  })

  it('records the use and resolves it back from the items list', () => {
    const apiRef: { current: UseLastUsedResult<Item> | null } = { current: null }
    render(<Harness apiRef={apiRef} items={items} storageKey="t.last:v1" />)
    act(() => apiRef.current?.recordUse(bravo))
    expect(apiRef.current?.lastUsed).toEqual(bravo)
    expect(JSON.parse(localStorage.getItem('t.last:v1') ?? 'null')).toBe('b')
  })

  it('returns null when the stored id is no longer in the items list', () => {
    localStorage.setItem('t.last:v1', JSON.stringify('ghost'))
    const apiRef: { current: UseLastUsedResult<Item> | null } = { current: null }
    render(<Harness apiRef={apiRef} items={items} storageKey="t.last:v1" />)
    expect(apiRef.current?.lastUsed).toBeNull()
  })

  it('clear() removes the stored id', () => {
    const apiRef: { current: UseLastUsedResult<Item> | null } = { current: null }
    render(<Harness apiRef={apiRef} items={items} storageKey="t.last:v1" />)
    act(() => apiRef.current?.recordUse(alpha))
    expect(apiRef.current?.lastUsed).toEqual(alpha)
    act(() => apiRef.current?.clear())
    expect(apiRef.current?.lastUsed).toBeNull()
  })
})
