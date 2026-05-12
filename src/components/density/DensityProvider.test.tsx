import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DensityProvider, useDensity } from './DensityProvider'

function Probe() {
  const { density, setDensity } = useDensity()
  return (
    <div>
      <output data-testid="value">{density}</output>
      <button type="button" onClick={() => setDensity('spacious')}>
        spacious
      </button>
      <button type="button" onClick={() => setDensity('compact')}>
        compact
      </button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.density
})

describe('DensityProvider', () => {
  it('defaults to compact and reflects to <html>', async () => {
    render(
      <DensityProvider>
        <Probe />
      </DensityProvider>,
    )
    expect(screen.getByTestId('value').textContent).toBe('compact')
    // Effect runs synchronously under React 19 + happy-dom for this case.
    expect(document.documentElement.dataset.density).toBe('compact')
  })

  it('switching to spacious flips the html attribute and persists', () => {
    render(
      <DensityProvider>
        <Probe />
      </DensityProvider>,
    )
    act(() => {
      screen.getByText('spacious').click()
    })
    expect(screen.getByTestId('value').textContent).toBe('spacious')
    expect(document.documentElement.dataset.density).toBe('spacious')
    expect(localStorage.getItem('boop.density')).toBe('"spacious"')
  })

  it('rehydrates from localStorage on mount', () => {
    localStorage.setItem('boop.density', '"spacious"')
    render(
      <DensityProvider>
        <Probe />
      </DensityProvider>,
    )
    expect(screen.getByTestId('value').textContent).toBe('spacious')
    expect(document.documentElement.dataset.density).toBe('spacious')
  })

  it('ignores invalid stored values and falls back to compact', () => {
    localStorage.setItem('boop.density', '"weird"')
    render(
      <DensityProvider>
        <Probe />
      </DensityProvider>,
    )
    expect(screen.getByTestId('value').textContent).toBe('compact')
  })
})
