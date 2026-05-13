import { renderAlertTemplate } from '@/lib/alert-context/render'
import type { AlertContext } from '@/shared/schemas/alert-context'
import { type AdapterFn, classifyHttpResult, networkFailure } from './types'

async function renderWebhookBody(template: string, context: AlertContext): Promise<string> {
  switch (context.kind) {
    case 'run':
    case 'missed':
      return renderAlertTemplate(template, context)
  }
}

export const deliverWebhook: AdapterFn = async ({ channel, alertContext }) => {
  if (channel.config.kind !== 'webhook') {
    return {
      ok: false,
      retryable: false,
      reason: `Expected webhook config, got ${channel.config.kind}`,
    }
  }
  const { url, method, headers: configHeaders, body_template } = channel.config
  let body: string
  try {
    body = await renderWebhookBody(body_template, alertContext)
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'render error'
    return { ok: false, retryable: false, reason: `Body template render failed: ${reason}` }
  }
  const headers: Record<string, string> = { 'content-type': 'application/json', ...configHeaders }
  try {
    const res = await fetch(url, { method, headers, body })
    return classifyHttpResult(res.status)
  } catch (err) {
    return networkFailure(err)
  }
}
