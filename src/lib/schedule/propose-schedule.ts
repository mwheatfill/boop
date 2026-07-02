import { generateObject } from 'ai'
import { getAIClient, getDefaultModelName } from '@/lib/ai/client'
import { nextRuns } from '@/lib/cron/next-runs'
import { isFiveFieldCron } from '@/lib/cron/validate'
import { z } from '@/shared/schemas/openapi'

const ScheduleProposalSchema = z.object({
  kind: z.enum(['cron', 'interval']),
  cronExpression: z.string().describe('5-field cron expression; required when kind is "cron"'),
  intervalSeconds: z
    .number()
    .int()
    .describe('seconds between fires; required when kind is "interval"'),
  summary: z.string().describe('short human-readable description of the cadence'),
})

export type ScheduleProposal = z.infer<typeof ScheduleProposalSchema>

export type ProposeScheduleResult =
  | { ok: true; proposal: ScheduleProposal }
  | { ok: false; reason: 'empty' | 'ai_unavailable' | 'invalid'; detail?: string }

function buildPrompt(text: string, timezone: string): string {
  return [
    'You convert a natural-language schedule into a machine schedule for an HTTP-job scheduler.',
    `The job runs in timezone ${timezone}.`,
    '',
    'Use kind "interval" with intervalSeconds only for simple "every N seconds/minutes" cadences, especially sub-minute. Otherwise use kind "cron". Prefer cron for any specific time or day, and for anything at 1-minute granularity or coarser.',
    '',
    'When kind is "cron", cronExpression MUST be a standard 5-field expression: "minute hour day-of-month month day-of-week". Rules:',
    '- Exactly 5 fields. No seconds field, no year field, and no "?" placeholder. Use "*" for "any value".',
    '- 24-hour clock: midnight=0, 9am=9, 3pm=15, 9pm=21.',
    '- The minute field encodes the minutes-past-the-hour. 3:00 PM is "0 15", NOT "15 15".',
    '- day-of-week: 0=Sunday, 1=Monday, ... 6=Saturday.',
    '- Multiple values use comma lists (hours "15,21" for 3pm and 9pm). Ranges use "-" ("1-5" = Mon-Fri). Steps use "/" ("*/2").',
    '- Nth weekday of the month uses "#": "0#3" = 3rd Sunday, "1#2" = 2nd Monday. Put it in the day-of-week field and keep day-of-month "*".',
    '- Never repeat a value within a field.',
    '- A single cron uses one minute value across all its hours, so you cannot fire at different minutes-past-the-hour for different hours in one schedule (e.g. exactly 3:00 PM and 4:30 PM together is impossible). When a request needs that, choose the closest single cron.',
    '',
    'Examples:',
    '- "every weekday at 9am" -> cron "0 9 * * 1-5"',
    '- "every day at midnight" -> cron "0 0 * * *"',
    '- "top of every hour" -> cron "0 * * * *"',
    '- "3pm and 9pm on the 3rd Sunday of every month" -> cron "0 15,21 * * 0#3"',
    '- "every 5 minutes" -> interval, intervalSeconds 300',
    '',
    'summary must be a short, accurate description of the exact schedule you encoded.',
    `Natural-language request: "${text}"`,
  ].join('\n')
}

export async function proposeSchedule(
  text: string,
  timezone: string,
): Promise<ProposeScheduleResult> {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }

  let model: ReturnType<ReturnType<typeof getAIClient>>
  try {
    model = getAIClient()(getDefaultModelName())
  } catch (err) {
    return {
      ok: false,
      reason: 'ai_unavailable',
      detail: err instanceof Error ? err.message : 'AI provider is not configured.',
    }
  }

  const { object } = await generateObject({
    model,
    schema: ScheduleProposalSchema,
    prompt: buildPrompt(trimmed, timezone),
  })

  if (object.kind === 'cron') {
    if (!isFiveFieldCron(object.cronExpression)) {
      return {
        ok: false,
        reason: 'invalid',
        detail: `Proposed a non 5-field cron: ${object.cronExpression}`,
      }
    }
    try {
      nextRuns({ expression: object.cronExpression, timezone, n: 1 })
    } catch {
      return {
        ok: false,
        reason: 'invalid',
        detail: `Proposed an invalid cron: ${object.cronExpression}`,
      }
    }
  } else if (!Number.isInteger(object.intervalSeconds) || object.intervalSeconds < 1) {
    return { ok: false, reason: 'invalid', detail: 'Proposed a non-positive interval.' }
  }

  return { ok: true, proposal: object }
}
