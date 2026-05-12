import { DurableObject } from 'cloudflare:workers'
import { createDb } from '@/lib/db/client'
import { dispatchRun } from './dispatch-run'
import {
  handleAlarm,
  handleCancel,
  handleSeed,
  type JobAlarmDeps,
  readJobLite,
  type SeedPayload,
} from './job-alarm'

export class JobAlarm extends DurableObject<Cloudflare.Env> {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }
    if (url.pathname === '/seed') {
      const payload = (await request.json()) as SeedPayload
      await handleSeed({ storage: this.ctx.storage }, payload)
      return new Response(null, { status: 204 })
    }
    if (url.pathname === '/cancel') {
      await handleCancel({ storage: this.ctx.storage })
      return new Response(null, { status: 204 })
    }
    return new Response('Not Found', { status: 404 })
  }

  override async alarm(alarmInfo?: AlarmInvocationInfo): Promise<void> {
    await handleAlarm(this.deps(), alarmInfo)
  }

  private deps(): JobAlarmDeps {
    const db = createDb(this.env.DB)
    return {
      storage: this.ctx.storage,
      readJob: (jobId) => readJobLite(db, jobId),
      runDispatch: (jobId, scheduledAt) => dispatchRun(this.env, jobId, scheduledAt, 'interval'),
    }
  }
}
