import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type UsePickerRecentsResult, usePickerRecents } from './use-picker-recents'

interface Item {
  id: string
  name: string
}

const alpha: Item = { id: 'a', name: 'Alpha' }
const bravo: Item = { id: 'b', name: 'Bravo' }
const charlie: Item = { id: 'c', name: 'Charlie' }
const delta: Item = { id: 'd', name: 'Delta' }
const items: Item[] = [alpha, bravo, charlie, delta]

function Harness({
  apiRef,
  list = items,
  storageKey = 't.recents:v1',
  limit = 3,
}: {
  apiRef: { current: UsePickerRecentsResult<Item> | null }
  list?: Item[]
  storageKey?: string
  limit?: number
}) {
  apiRef.current = usePickerRecents<Item>(storageKey, list, (i) => i.id, limit)
  return null
}

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('usePickerRecents', () => {
  it('records uses in MRU order', () => {
    const apiRef: { current: UsePickerRecentsResult<Item> | null } = { current: null }
    render(<Harness apiRef={apiRef} />)
    act(() => apiRef.current?.recordUse(alpha))
    act(() => apiRef.current?.recordUse(bravo))
    expect(apiRef.current?.recents.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('de-duplicates when the same item is recorded again', () => {
    const apiRef: { current: UsePickerRecentsResult<Item> | null } = { current: null }
    render(<Harness apiRef={apiRef} />)
    act(() => apiRef.current?.recordUse(alpha))
    act(() => apiRef.current?.recordUse(bravo))
    act(() => apiRef.current?.recordUse(alpha))
    expect(apiRef.current?.recents.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('caps at the limit', () => {
    const apiRef: { current: UsePickerRecentsResult<Item> | null } = { current: null }
    render(<Harness apiRef={apiRef} limit={2} />)
    for (const item of items) {
      act(() => apiRef.current?.recordUse(item))
    }
    expect(apiRef.current?.recents.map((r) => r.id)).toEqual(['d', 'c'])
  })

  it('filters out ids no longer in the items list', () => {
    localStorage.setItem('t.recents:v1', JSON.stringify(['ghost', 'a']))
    const apiRef: { current: UsePickerRecentsResult<Item> | null } = { current: null }
    render(<Harness apiRef={apiRef} />)
    expect(apiRef.current?.recents.map((r) => r.id)).toEqual(['a'])
  })
})
