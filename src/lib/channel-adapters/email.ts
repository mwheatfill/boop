import { renderAlertTemplate } from '@/lib/alert-context/render'
import { mailer } from '@/lib/email-recipe'
import type { AlertContext } from '@/shared/schemas/alert-context'
import type { AdapterFn } from './types'

async function renderEmailTemplates(
  subjectTemplate: string,
  bodyTemplate: string,
  context: AlertContext,
): Promise<[string, string]> {
  switch (context.kind) {
    case 'run':
    case 'missed':
      return Promise.all([
        renderAlertTemplate(subjectTemplate, context),
        renderAlertTemplate(bodyTemplate, context),
      ])
  }
}

export const deliverEmail: AdapterFn = async ({ channel, alertContext }) => {
  if (!mailer) {
    return { ok: false, retryable: false, reason: 'email/send-pipeline recipe not installed' }
  }
  if (channel.config.kind !== 'email') {
    return {
      ok: false,
      retryable: false,
      reason: `Expected email config, got ${channel.config.kind}`,
    }
  }
  const { recipients, subject_template, body_template } = channel.config
  let subject: string
  let body: string
  try {
    ;[subject, body] = await renderEmailTemplates(subject_template, body_template, alertContext)
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'render error'
    return { ok: false, retryable: false, reason: `Email template render failed: ${reason}` }
  }
  const result = await mailer({ to: recipients, subject, html: body, text: body })
  if (result.ok) return { ok: true }
  return {
    ok: false,
    retryable: result.retryable ?? true,
    reason: result.reason ?? 'mailer failed',
  }
}
