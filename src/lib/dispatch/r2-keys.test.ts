import { describe, expect, it } from 'vitest'
import { r2KeyFor } from './r2-keys'

describe('r2KeyFor', () => {
  it('returns the documented runs/{customer}/{run}/{attempt}.{kind} shape', () => {
    expect(r2KeyFor('cust_x', 'run_y', 1, 'request')).toBe('runs/cust_x/run_y/1.request')
    expect(r2KeyFor('cust_x', 'run_y', 1, 'response')).toBe('runs/cust_x/run_y/1.response')
  })

  it('is deterministic for the same inputs', () => {
    expect(r2KeyFor('a', 'b', 3, 'response')).toBe(r2KeyFor('a', 'b', 3, 'response'))
  })
})
