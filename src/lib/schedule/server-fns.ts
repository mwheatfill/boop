import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { ProposeScheduleInput } from '@/shared/schemas/schedule'
import { type ProposeScheduleResult, proposeSchedule } from './propose-schedule'

export const proposeScheduleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { text: string; timezone: string }) => ProposeScheduleInput.parse(data))
  .handler(async ({ data }): Promise<ProposeScheduleResult> => {
    try {
      return await proposeSchedule(data.text, data.timezone)
    } catch (err) {
      return {
        ok: false,
        reason: 'ai_unavailable',
        detail: err instanceof Error ? err.message : 'AI request failed.',
      }
    }
  })
