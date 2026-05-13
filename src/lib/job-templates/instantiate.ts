import type { JobCreateInput } from '@/shared/schemas/job'
import type { JobTemplate } from '@/shared/schemas/job-template'

export function instantiateFromTemplate(
  template: JobTemplate,
  customerSlug: string,
): JobCreateInput & { customerSlug: string } {
  const trigger =
    template.triggerKind === 'cron'
      ? {
          triggerKind: 'cron' as const,
          cronExpression: String(template.triggerConfig.cronExpression ?? '0 9 * * *'),
          triggerTimezone: String(template.triggerConfig.triggerTimezone ?? 'UTC'),
        }
      : template.triggerKind === 'interval'
        ? {
            triggerKind: 'interval' as const,
            intervalSeconds: Number(template.triggerConfig.intervalSeconds ?? 300),
          }
        : { triggerKind: 'webhook' as const }

  return {
    customerSlug,
    name: template.name,
    slug: template.slug,
    targetSlug: template.scope === 'customer' ? template.targetRef : '',
    trigger,
    bodyTemplate: template.bodyTemplate,
    headersTemplate: template.headersTemplate,
    variables: template.variables,
    maxAttempts: template.maxAttempts,
    overallDeadlineMs: template.overallDeadlineMs,
  }
}
