import type { JobTemplate, JobTemplateTag } from '@/shared/schemas/job-template'

export const TEMPLATE_TAG_LABELS: Record<JobTemplateTag, string> = {
  backups: 'Backups',
  'health-checks': 'Health checks',
  reports: 'Reports',
  integrations: 'Integrations',
  maintenance: 'Maintenance',
  custom: 'Custom',
}

export function templateTagLabel(tag: JobTemplateTag): string {
  return TEMPLATE_TAG_LABELS[tag]
}

export function humanizeTemplateSchedule(template: JobTemplate): string {
  if (template.triggerKind === 'webhook') return 'Starts from an inbound webhook'
  if (template.triggerKind === 'interval') {
    const seconds = Number(template.triggerConfig.intervalSeconds ?? 0)
    if (seconds >= 3600 && seconds % 3600 === 0) return `Runs every ${seconds / 3600}h`
    if (seconds >= 60 && seconds % 60 === 0) return `Runs every ${seconds / 60}m`
    return `Runs every ${seconds}s`
  }
  const expression = String(template.triggerConfig.cronExpression ?? '')
  const timezone = String(template.triggerConfig.triggerTimezone ?? 'Customer timezone')
  return expression ? `Cron ${expression} in ${timezone}` : `Cron schedule in ${timezone}`
}
