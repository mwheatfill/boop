export type TriggerKind = 'cron' | 'interval' | 'webhook' | 'manual'

export type TriggerColumn = 'cron_expression' | 'interval_seconds' | 'trigger_timezone'

export interface TriggerTransitionInput {
  oldKind: TriggerKind
  newKind: TriggerKind
  oldIntervalSeconds: number | null
  newIntervalSeconds: number | null
}

export interface TriggerTransitionPlan {
  modeChange: TriggerKind | null
  columnsToNull: TriggerColumn[]
}

const cronColumns: TriggerColumn[] = ['cron_expression', 'trigger_timezone']
const intervalColumns: TriggerColumn[] = ['interval_seconds']

export function planTriggerTransition({
  oldKind,
  newKind,
  oldIntervalSeconds,
  newIntervalSeconds,
}: TriggerTransitionInput): TriggerTransitionPlan {
  if (oldKind === newKind) {
    if (newKind === 'interval' && oldIntervalSeconds !== newIntervalSeconds) {
      return { modeChange: 'interval', columnsToNull: [] }
    }
    return { modeChange: null, columnsToNull: [] }
  }

  const columnsToNull: TriggerColumn[] = []
  if (oldKind === 'cron') columnsToNull.push(...cronColumns)
  if (oldKind === 'interval') {
    columnsToNull.push(...intervalColumns)
    if (newKind === 'webhook' || newKind === 'manual') columnsToNull.push('trigger_timezone')
  }

  return { modeChange: newKind, columnsToNull }
}
