import { env } from 'cloudflare:workers'
import { renderAlertTemplate } from '@/lib/alert-context/render'
import { type GraphMailEnv, graphConfigFromEnv, sendViaGraph } from '@/lib/email-recipe/graph'
import type { AlertContext } from '@/shared/schemas/alert-context'
import type { EmailConfig } from '@/shared/schemas/channel'
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

export const deliverEmail: AdapterFn<EmailConfig> = async (config, ctx) => {
  const graphConfig = graphConfigFromEnv(env as unknown as GraphMailEnv)
  if (!graphConfig) {
    return { ok: false, retryable: false, reason: 'Microsoft Graph email is not configured' }
  }
  const { recipients, subject_template, body_template } = config
  let subject: string
  let body: string
  try {
    ;[subject, body] = await renderEmailTemplates(subject_template, body_template, ctx)
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'render error'
    return { ok: false, retryable: false, reason: `Email template render failed: ${reason}` }
  }
  const result = await sendViaGraph(graphConfig, {
    to: recipients,
    subject,
    html: body,
    text: body,
  })
  if (result.ok) return { ok: true }
  return {
    ok: false,
    retryable: result.retryable ?? true,
    reason: result.reason ?? 'mailer failed',
  }
}
