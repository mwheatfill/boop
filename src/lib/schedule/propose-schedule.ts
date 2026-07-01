import { generateObject } from 'ai'
import { getAIClient, getDefaultModelName } from '@/lib/ai/client'
import { nextRuns } from '@/lib/cron/next-runs'
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
    'Choose "cron" with a standard 5-field cron expression for calendar cadences',
    '(specific times or days, at minute granularity or coarser).',
    'Choose "interval" with intervalSeconds for simple "every N" cadences, especially sub-minute.',
    'Prefer cron for anything at 1-minute granularity or coarser.',
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
