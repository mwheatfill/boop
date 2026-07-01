import type { AlertContext } from '@/shared/schemas/alert-context'
import type { TeamsConfig } from '@/shared/schemas/channel'
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

interface AdaptiveCardAction {
  type: 'Action.OpenUrl'
  title: string
  url: string
}

function statusColor(outcome: string): 'Good' | 'Warning' | 'Attention' | 'Default' {
  if (outcome === 'success') return 'Good'
  if (outcome === 'failure') return 'Attention'
  if (outcome === 'timeout') return 'Warning'
  return 'Default'
}

function minutesLabel(minutes: number): string {
  if (minutes % (24 * 60) === 0) return `${minutes / (24 * 60)}d`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${minutes}m`
}

function adaptiveCard(body: AdaptiveCardElement[], action: AdaptiveCardAction): unknown {
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
          actions: [action],
        },
      },
    ],
  }
}

function buildRunCard(ctx: Extract<AlertContext, { kind: 'run' }>): unknown {
  const headline = ctx.test
    ? `boop test alert · ${ctx.workspace_name}`
    : `${ctx.workspace_name} · ${ctx.job_name} · ${ctx.outcome}`

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

  return adaptiveCard(body, { type: 'Action.OpenUrl', title: 'Open Run', url: ctx.run_url })
}

function buildMissedCard(ctx: Extract<AlertContext, { kind: 'missed' }>): unknown {
  const body: AdaptiveCardElement[] = [
    {
      type: 'TextBlock',
      text: `${ctx.workspace_name} · ${ctx.job_name} has not fired in ${minutesLabel(
        ctx.silence_threshold_minutes,
      )}`,
      size: 'Large',
      weight: 'Bolder',
      wrap: true,
    },
    {
      type: 'TextBlock',
      text: ctx.rule_name,
      spacing: 'None',
      color: 'Warning',
      wrap: true,
    },
    {
      type: 'FactSet',
      facts: [
        { title: 'Last Run', value: ctx.last_run_at ?? 'Never' },
        { title: 'Silence window', value: minutesLabel(ctx.silence_threshold_minutes) },
        { title: 'Trigger', value: ctx.trigger_source },
        { title: 'Schedule', value: ctx.schedule },
      ],
    },
  ]

  return adaptiveCard(body, { type: 'Action.OpenUrl', title: 'Open Job', url: ctx.job_url })
}

export function buildTeamsCard(ctx: AlertContext): unknown {
  switch (ctx.kind) {
    case 'run':
      return buildRunCard(ctx)
    case 'missed':
      return buildMissedCard(ctx)
  }
}

export const deliverTeams: AdapterFn<TeamsConfig> = async (config, ctx) => {
  try {
    const res = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildTeamsCard(ctx)),
    })
    return classifyHttpResult(res.status)
  } catch (err) {
    return networkFailure(err)
  }
}
