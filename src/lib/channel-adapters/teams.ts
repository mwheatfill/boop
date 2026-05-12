import type { AlertContext } from '@/shared/schemas/alert-context'
import { ChannelConfigSchema } from '@/shared/schemas/channel'
import { type AdapterFn, classifyHttpResult, networkFailure } from './types'

const ADAPTIVE_CARD_VERSION = '1.5'

interface AdaptiveCardElement {
  type: string
  text?: string
  size?: string
  weight?: string
  wrap?: boolean
  color?: string
  spacing?: string
  facts?: { title: string; value: string }[]
}

function statusColor(outcome: string): 'Good' | 'Warning' | 'Attention' | 'Default' {
  if (outcome === 'success') return 'Good'
  if (outcome === 'failure') return 'Attention'
  if (outcome === 'timeout') return 'Warning'
  return 'Default'
}

export function buildTeamsCard(ctx: AlertContext): unknown {
  const headline = ctx.test
    ? `boop test alert · ${ctx.customer_name}`
    : `${ctx.customer_name} · ${ctx.job_name} · ${ctx.outcome}`

  const body: AdaptiveCardElement[] = [
    { type: 'TextBlock', text: headline, size: 'Large', weight: 'Bolder', wrap: true },
    {
      type: 'TextBlock',
      text: ctx.rule_name,
      spacing: 'None',
      color: statusColor(ctx.outcome),
      wrap: true,
    },
    {
      type: 'FactSet',
      facts: [
        { title: 'Target', value: `${ctx.target_name} (${ctx.target_url})` },
        { title: 'Started', value: ctx.started_at },
        { title: 'Completed', value: ctx.completed_at },
        { title: 'Duration', value: `${ctx.duration_ms}ms` },
        { title: 'Attempts', value: String(ctx.attempt_count) },
        ...(ctx.failure_kind ? [{ title: 'Failure', value: ctx.failure_kind }] : []),
        { title: 'Trigger', value: ctx.trigger_source },
      ],
    },
  ]

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: ADAPTIVE_CARD_VERSION,
          body,
          actions: [{ type: 'Action.OpenUrl', title: 'Open Run', url: ctx.run_url }],
        },
      },
    ],
  }
}

export const deliverTeams: AdapterFn = async ({ channel, alertContext }) => {
  const config = ChannelConfigSchema.parse({ kind: channel.kind, ...channel.config })
  if (config.kind !== 'teams') {
    return { ok: false, retryable: false, reason: `Expected teams config, got ${config.kind}` }
  }
  try {
    const res = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildTeamsCard(alertContext)),
    })
    return classifyHttpResult(res.status)
  } catch (err) {
    return networkFailure(err)
  }
}
