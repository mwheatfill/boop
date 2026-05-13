import { describe, expect, it } from 'vitest'
import type { JobTemplate } from '@/shared/schemas/job-template'
import { instantiateFromTemplate } from './instantiate'

const base: JobTemplate = {
  id: 'jtpl_1',
  name: 'Daily backup',
  slug: 'daily-backup',
  scope: 'workspace',
  customerId: null,
  customerSlug: null,
  customerName: null,
  tag: 'backups',
  icon: 'database',
  description: 'Backup endpoint',
  triggerKind: 'cron',
  triggerConfig: { cronExpression: '0 2 * * *', triggerTimezone: 'America/Phoenix' },
  targetRef: 'backup_endpoint',
  bodyTemplate: '{"kind":"backup"}',
  headersTemplate: '{}',
  variables: { tenant_id: 'acme' },
  maxAttempts: 4,
  overallDeadlineMs: 120_000,
  builtIn: true,
  status: 'active',
  createdAt: '2026-05-13T00:00:00.000Z',
  updatedAt: '2026-05-13T00:00:00.000Z',
  archivedAt: null,
}

describe('instantiateFromTemplate', () => {
  it('leaves workspace template target placeholders unresolved', () => {
    const input = instantiateFromTemplate(base, 'acme')
    expect(input.customerSlug).toBe('acme')
    expect(input.targetSlug).toBe('')
    expect(input.trigger).toEqual({
      triggerKind: 'cron',
      cronExpression: '0 2 * * *',
      triggerTimezone: 'America/Phoenix',
    })
    expect(input.variables).toEqual({ tenant_id: 'acme' })
  })

  it('uses the stored Target slug for Customer-scoped templates', () => {
    const input = instantiateFromTemplate(
      { ...base, scope: 'customer', customerId: 'cust_1', targetRef: 'prod-api' },
      'acme',
    )
    expect(input.targetSlug).toBe('prod-api')
  })

  it('maps interval trigger config', () => {
    const input = instantiateFromTemplate(
      { ...base, triggerKind: 'interval', triggerConfig: { intervalSeconds: 300 } },
      'acme',
    )
    expect(input.trigger).toEqual({ triggerKind: 'interval', intervalSeconds: 300 })
  })
})
