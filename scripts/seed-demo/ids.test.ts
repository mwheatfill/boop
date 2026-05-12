import { describe, expect, it } from 'vitest'
import { demoId } from './ids'

describe('demoId', () => {
  it('produces the same id for the same (prefix, ...segments)', () => {
    expect(demoId('cust', 'desert-vista-cu')).toBe(demoId('cust', 'desert-vista-cu'))
    expect(demoId('job', 'desert-vista-cu', 'ach-transactions-ingest')).toBe(
      demoId('job', 'desert-vista-cu', 'ach-transactions-ingest'),
    )
  })

  it('produces different ids for different inputs', () => {
    expect(demoId('cust', 'one')).not.toBe(demoId('cust', 'two'))
    expect(demoId('cust', 'x')).not.toBe(demoId('job', 'x'))
  })

  it('respects the existing prefix scheme', () => {
    expect(demoId('cust', 'x')).toMatch(/^cust_[0-9a-z]{26}$/)
    expect(demoId('job', 'x')).toMatch(/^job_[0-9a-z]{26}$/)
    expect(demoId('run', 'x', '1')).toMatch(/^run_[0-9a-z]{26}$/)
  })
})
