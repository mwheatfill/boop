import { describe, expect, it } from 'vitest'
import {
  handleAlarm,
  handleCancel,
  handleSeed,
  type JobAlarmRow,
  type JobAlarmStorage,
} from './job-alarm'

function fakeStorage(): JobAlarmStorage & {
  _alarm: number | null
  _kv: Map<string, unknown>
} {
  const kv = new Map<string, unknown>()
  const self = {
    _alarm: null as number | null,
    _kv: kv,
    setAlarm(ts: number | Date) {
      self._alarm = ts instanceof Date ? ts.getTime() : ts
    },
    deleteAlarm() {
      self._alarm = null
    },
    async getAlarm() {
      return self._alarm
    },
    async get<T = unknown>(key: string) {
      return kv.get(key) as T | undefined
    },
    async put(key: string, value: unknown) {
      kv.set(key, value)
    },
    async delete(key: string) {
      kv.delete(key)
    },
  }
  return self
}

describe('handleSeed', () => {
  it('persists jobId + intervalSeconds and sets an alarm intervalSeconds away', async () => {
    const storage = fakeStorage()
    const tick = new Date('2026-05-12T14:30:00.000Z')
    await handleSeed({ storage, now: () => tick }, { jobId: 'job_1', intervalSeconds: 30 })
    expect(await storage.get('jobId')).toBe('job_1')
    expect(await storage.get('intervalSeconds')).toBe(30)
    expect(storage._alarm).toBe(tick.getTime() + 30_000)
  })

  it('rejects intervalSeconds <= 0', async () => {
    const storage = fakeStorage()
    await expect(handleSeed({ storage }, { jobId: 'job_1', intervalSeconds: 0 })).rejects.toThrow()
  })
})

describe('handleCancel', () => {
  it('clears alarm and tracked job state', async () => {
    const storage = fakeStorage()
    await handleSeed({ storage, now: () => new Date() }, { jobId: 'job_1', intervalSeconds: 30 })
    await handleCancel({ storage })
    expect(storage._alarm).toBeNull()
    expect(await storage.get('jobId')).toBeUndefined()
    expect(await storage.get('intervalSeconds')).toBeUndefined()
  })
})

describe('handleAlarm', () => {
  function activeIntervalRow(intervalSeconds: number): JobAlarmRow {
    return { status: 'active', triggerKind: 'interval', intervalSeconds }
  }

  it('reschedules and dispatches on active interval Job', async () => {
    const storage = fakeStorage()
    const tick = new Date('2026-05-12T14:30:30.000Z')
    await handleSeed(
      { storage, now: () => new Date(tick.getTime() - 30_000) },
      {
        jobId: 'job_1',
        intervalSeconds: 30,
      },
    )
    const dispatched: { jobId: string; at: Date }[] = []
    await handleAlarm({
      storage,
      now: () => tick,
      async readJob() {
        return activeIntervalRow(30)
      },
      async runDispatch(jobId, at) {
        dispatched.push({ jobId, at })
      },
    })
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0]?.jobId).toBe('job_1')
    expect(storage._alarm).toBe(tick.getTime() + 30_000)
  })

  it('re-arms from the scheduled tick when the run finishes within the interval', async () => {
    const storage = fakeStorage()
    const start = new Date('2026-05-12T14:30:30.000Z').getTime()
    let clock = start
    await handleSeed(
      { storage, now: () => new Date(start - 30_000) },
      { jobId: 'job_1', intervalSeconds: 30 },
    )
    await handleAlarm({
      storage,
      now: () => new Date(clock),
      async readJob() {
        return activeIntervalRow(30)
      },
      async runDispatch() {
        clock += 5_000 // run took 5s, under the interval
      },
    })
    // start-to-start: next fire is start + 30s, not (start + 5s) + 30s
    expect(storage._alarm).toBe(start + 30_000)
  })

  it('fires as soon as a run that overran the interval finishes (never overlaps)', async () => {
    const storage = fakeStorage()
    const start = new Date('2026-05-12T14:30:30.000Z').getTime()
    let clock = start
    await handleSeed(
      { storage, now: () => new Date(start - 30_000) },
      { jobId: 'job_1', intervalSeconds: 30 },
    )
    await handleAlarm({
      storage,
      now: () => new Date(clock),
      async readJob() {
        return activeIntervalRow(30)
      },
      async runDispatch() {
        clock += 45_000 // run took 45s, over the 30s interval
      },
    })
    // tick + interval (start + 30s) is already past; fire now (start + 45s), not start + 75s
    expect(storage._alarm).toBe(start + 45_000)
  })

  it('does not reschedule when Job has been paused', async () => {
    const storage = fakeStorage()
    await handleSeed({ storage, now: () => new Date() }, { jobId: 'job_1', intervalSeconds: 30 })
    storage.deleteAlarm()
    await handleAlarm({
      storage,
      async readJob() {
        return { status: 'paused', triggerKind: 'interval', intervalSeconds: 30 }
      },
      async runDispatch() {
        throw new Error('should not dispatch')
      },
    })
    expect(storage._alarm).toBeNull()
  })

  it('does not reschedule when triggerKind is no longer interval', async () => {
    const storage = fakeStorage()
    await handleSeed({ storage, now: () => new Date() }, { jobId: 'job_1', intervalSeconds: 30 })
    storage.deleteAlarm()
    await handleAlarm({
      storage,
      async readJob() {
        return { status: 'active', triggerKind: 'cron', intervalSeconds: null }
      },
      async runDispatch() {
        throw new Error('should not dispatch')
      },
    })
    expect(storage._alarm).toBeNull()
  })

  it('reschedules even when dispatch throws', async () => {
    const storage = fakeStorage()
    const tick = new Date('2026-05-12T14:30:30.000Z')
    await handleSeed(
      { storage, now: () => new Date(tick.getTime() - 30_000) },
      {
        jobId: 'job_1',
        intervalSeconds: 30,
      },
    )
    await handleAlarm({
      storage,
      now: () => tick,
      async readJob() {
        return activeIntervalRow(30)
      },
      async runDispatch() {
        throw new Error('target unreachable')
      },
    })
    expect(storage._alarm).toBe(tick.getTime() + 30_000)
  })

  it('no-ops when storage has no tracked jobId', async () => {
    const storage = fakeStorage()
    let readCalls = 0
    await handleAlarm({
      storage,
      async readJob() {
        readCalls++
        return null
      },
      async runDispatch() {
        throw new Error('should not dispatch')
      },
    })
    expect(readCalls).toBe(0)
    expect(storage._alarm).toBeNull()
  })

  it('does not reschedule when the Job has been deleted', async () => {
    const storage = fakeStorage()
    await handleSeed({ storage, now: () => new Date() }, { jobId: 'job_1', intervalSeconds: 30 })
    storage.deleteAlarm()
    await handleAlarm({
      storage,
      async readJob() {
        return null
      },
      async runDispatch() {
        throw new Error('should not dispatch')
      },
    })
    expect(storage._alarm).toBeNull()
  })
})
