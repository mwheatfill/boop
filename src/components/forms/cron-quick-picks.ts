export interface CronQuickPick {
  label: string
  expression: string
}

export const CRON_QUICK_PICKS: CronQuickPick[] = [
  { label: 'Every minute', expression: '* * * * *' },
  { label: 'Every 5m', expression: '*/5 * * * *' },
  { label: 'Hourly', expression: '0 * * * *' },
  { label: 'Daily 9am', expression: '0 9 * * *' },
  { label: 'Weekdays 9am', expression: '0 9 * * MON-FRI' },
  { label: 'Monthly 1st', expression: '0 9 1 * *' },
]
