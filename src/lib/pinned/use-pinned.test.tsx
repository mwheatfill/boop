import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PINNED_LIMIT, PINNED_STORAGE_KEY, type PinnedEntity } from './store'
import { usePinned } from './use-pinned'

type Api = ReturnType<typeof usePinned>

// Render-driven harness that exposes the hook's state to the DOM so tests
// can assert via Testing Library instead of importing the hook output.
function Harness({ apiRef }: { apiRef: { current: Api | null } }) {
  const api = usePinned()
  apiRef.current = api
  return (
    <ul data-testid="pinned-list">
      {api.pinned.map((p) => (
        <li key={`${p.kind}:${p.id}`} data-testid="pin-item">
          {p.label}
        </li>
      ))}
    </ul>
  )
}

const workspace = (id: string, label: string): PinnedEntity => ({
  id,
  kind: 'workspace',
  label,
  slug: id,
})

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePinned', () => {
  it('starts empty and reports isPinned=false', () => {
    const apiRef: { current: Api | null } = { current: null }
    render(<Harness apiRef={apiRef} />)
    expect(apiRef.current).not.toBeNull()
    expect(apiRef.current?.pinned).toEqual([])
    expect(apiRef.current?.isPinned({ id: 'x', kind: 'workspace' })).toBe(false)
  })

  it('pinning adds the entity and sorts alphabetically', () => {
    const apiRef: { current: Api | null } = { current: null }
    render(<Harness apiRef={apiRef} />)
    act(() => {
      apiRef.current?.togglePin(workspace('b', 'Bravo'))
    })
    act(() => {
      apiRef.current?.togglePin(workspace('a', 'Alpha'))
    })
    const items = screen.getAllByTestId('pin-item').map((n) => n.textContent)
    expect(items).toEqual(['Alpha', 'Bravo'])
  })

  it('toggle removes when already pinned', () => {
    const apiRef: { current: Api | null } = { current: null }
    render(<Harness apiRef={apiRef} />)
    act(() => {
      apiRef.current?.togglePin(workspace('a', 'Alpha'))
    })
    expect(screen.getAllByTestId('pin-item')).toHaveLength(1)
    act(() => {
      apiRef.current?.togglePin(workspace('a', 'Alpha'))
    })
    expect(screen.queryAllByTestId('pin-item')).toHaveLength(0)
  })

  it('refuses to add a 21st pin', () => {
    const apiRef: { current: Api | null } = { current: null }
    render(<Harness apiRef={apiRef} />)
    for (let i = 0; i < PINNED_LIMIT; i++) {
      act(() => {
        apiRef.current?.togglePin(workspace(`c-${i}`, `C-${String(i).padStart(2, '0')}`))
      })
    }
    expect(screen.getAllByTestId('pin-item')).toHaveLength(PINNED_LIMIT)
    act(() => {
      apiRef.current?.togglePin(workspace('overflow', 'Overflow'))
    })
    expect(screen.getAllByTestId('pin-item')).toHaveLength(PINNED_LIMIT)
    expect(apiRef.current?.isPinned({ id: 'overflow', kind: 'workspace' })).toBe(false)
  })

  it('round-trips through localStorage', () => {
    const apiRef: { current: Api | null } = { current: null }
    const first = render(<Harness apiRef={apiRef} />)
    act(() => {
      apiRef.current?.togglePin(workspace('persist', 'Persist Me'))
    })
    expect(localStorage.getItem(PINNED_STORAGE_KEY)).toContain('Persist Me')
    first.unmount()

    const apiRef2: { current: Api | null } = { current: null }
    render(<Harness apiRef={apiRef2} />)
    // The mount effect rehydrates from storage.
    expect(apiRef2.current?.pinned.map((p) => p.label)).toEqual(['Persist Me'])
  })

  it('tolerates malformed storage', () => {
    localStorage.setItem(PINNED_STORAGE_KEY, 'not json')
    const apiRef: { current: Api | null } = { current: null }
    render(<Harness apiRef={apiRef} />)
    expect(apiRef.current?.pinned).toEqual([])
  })
})
