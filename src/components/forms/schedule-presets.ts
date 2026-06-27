export interface SchedulePreset {
  label: string
  kind: 'cron' | 'interval'
  cronExpression: string
  intervalSeconds: number
}

// Sub-minute cadences resolve to an interval (Alarm lane); everything at
// minute-or-coarser granularity resolves to cron (Queue lane, cheaper).
export const SCHEDULE_PRESETS: SchedulePreset[] = [
  { label: 'Every 30s', kind: 'interval', cronExpression: '', intervalSeconds: 30 },
  { label: 'Every minute', kind: 'cron', cronExpression: '* * * * *', intervalSeconds: 60 },
  { label: 'Every 5m', kind: 'cron', cronExpression: '*/5 * * * *', intervalSeconds: 300 },
  { label: 'Every 15m', kind: 'cron', cronExpression: '*/15 * * * *', intervalSeconds: 900 },
  { label: 'Hourly', kind: 'cron', cronExpression: '0 * * * *', intervalSeconds: 3600 },
  { label: 'Every 6h', kind: 'cron', cronExpression: '0 */6 * * *', intervalSeconds: 21_600 },
  { label: 'Daily 9am', kind: 'cron', cronExpression: '0 9 * * *', intervalSeconds: 86_400 },
  {
    label: 'Weekdays 9am',
    kind: 'cron',
    cronExpression: '0 9 * * MON-FRI',
    intervalSeconds: 86_400,
  },
  {
    label: 'Weekly Mon 9am',
    kind: 'cron',
    cronExpression: '0 9 * * MON',
    intervalSeconds: 604_800,
  },
]
