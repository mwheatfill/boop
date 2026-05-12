import { describe, expect, it } from 'vitest'
import { planTriggerTransition, type TriggerKind } from './trigger-transition'

describe('planTriggerTransition', () => {
  describe('same-kind transitions', () => {
    it('cron → cron is a no-op', () => {
      expect(
        planTriggerTransition({
          oldKind: 'cron',
          newKind: 'cron',
          oldIntervalSeconds: null,
          newIntervalSeconds: null,
        }),
      ).toEqual({ modeChange: null, columnsToNull: [] })
    })

    it('webhook → webhook is a no-op', () => {
      expect(
        planTriggerTransition({
          oldKind: 'webhook',
          newKind: 'webhook',
          oldIntervalSeconds: null,
          newIntervalSeconds: null,
        }),
      ).toEqual({ modeChange: null, columnsToNull: [] })
    })

    it('interval → interval with unchanged seconds is a no-op', () => {
      expect(
        planTriggerTransition({
          oldKind: 'interval',
          newKind: 'interval',
          oldIntervalSeconds: 60,
          newIntervalSeconds: 60,
        }),
      ).toEqual({ modeChange: null, columnsToNull: [] })
    })

    it('interval → interval with changed seconds re-seeds the alarm', () => {
      expect(
        planTriggerTransition({
          oldKind: 'interval',
          newKind: 'interval',
          oldIntervalSeconds: 60,
          newIntervalSeconds: 30,
        }),
      ).toEqual({ modeChange: 'interval', columnsToNull: [] })
    })
  })

  describe('cron → other', () => {
    it('cron → interval enters interval mode, nulls cron columns', () => {
      expect(
        planTriggerTransition({
          oldKind: 'cron',
          newKind: 'interval',
          oldIntervalSeconds: null,
          newIntervalSeconds: 60,
        }),
      ).toEqual({
        modeChange: 'interval',
        columnsToNull: ['cron_expression', 'trigger_timezone'],
      })
    })

    it('cron → webhook enters webhook mode, nulls cron columns', () => {
      expect(
        planTriggerTransition({
          oldKind: 'cron',
          newKind: 'webhook',
          oldIntervalSeconds: null,
          newIntervalSeconds: null,
        }),
      ).toEqual({
        modeChange: 'webhook',
        columnsToNull: ['cron_expression', 'trigger_timezone'],
      })
    })
  })

  describe('interval → other', () => {
    it('interval → cron enters cron mode, nulls interval_seconds', () => {
      expect(
        planTriggerTransition({
          oldKind: 'interval',
          newKind: 'cron',
          oldIntervalSeconds: 60,
          newIntervalSeconds: null,
        }),
      ).toEqual({
        modeChange: 'cron',
        columnsToNull: ['interval_seconds'],
      })
    })

    it('interval → webhook enters webhook mode, nulls interval_seconds and trigger_timezone', () => {
      expect(
        planTriggerTransition({
          oldKind: 'interval',
          newKind: 'webhook',
          oldIntervalSeconds: 60,
          newIntervalSeconds: null,
        }),
      ).toEqual({
        modeChange: 'webhook',
        columnsToNull: ['interval_seconds', 'trigger_timezone'],
      })
    })
  })

  describe('webhook → other', () => {
    it('webhook → cron enters cron mode, nulls nothing', () => {
      expect(
        planTriggerTransition({
          oldKind: 'webhook',
          newKind: 'cron',
          oldIntervalSeconds: null,
          newIntervalSeconds: null,
        }),
      ).toEqual({ modeChange: 'cron', columnsToNull: [] })
    })

    it('webhook → interval enters interval mode, nulls nothing', () => {
      expect(
        planTriggerTransition({
          oldKind: 'webhook',
          newKind: 'interval',
          oldIntervalSeconds: null,
          newIntervalSeconds: 60,
        }),
      ).toEqual({ modeChange: 'interval', columnsToNull: [] })
    })
  })

  it('covers the full 3x3 kind matrix', () => {
    const kinds: TriggerKind[] = ['cron', 'interval', 'webhook']
    let total = 0
    for (const oldKind of kinds) {
      for (const newKind of kinds) {
        const plan = planTriggerTransition({
          oldKind,
          newKind,
          oldIntervalSeconds: oldKind === 'interval' ? 60 : null,
          newIntervalSeconds: newKind === 'interval' ? 60 : null,
        })
        expect(plan).toHaveProperty('modeChange')
        expect(plan).toHaveProperty('columnsToNull')
        total++
      }
    }
    expect(total).toBe(9)
  })
})
