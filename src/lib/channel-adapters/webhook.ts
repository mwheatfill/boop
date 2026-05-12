import { renderAlertTemplate } from '@/lib/alert-context/render'
import { ChannelConfigSchema } from '@/shared/schemas/channel'
import { type AdapterFn, classifyHttpResult, networkFailure } from './types'

export const deliverWebhook: AdapterFn = async ({ channel, alertContext }) => {
  const config = ChannelConfigSchema.parse({ kind: channel.kind, ...channel.config })
  if (config.kind !== 'webhook') {
    return { ok: false, retryable: false, reason: `Expected webhook config, got ${config.kind}` }
  }
  let body: string
  try {
    body = await renderAlertTemplate(config.body_template, alertContext)
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'render error'
    return { ok: false, retryable: false, reason: `Body template render failed: ${reason}` }
  }
  const headers: Record<string, string> = { 'content-type': 'application/json', ...config.headers }
  try {
    const res = await fetch(config.url, { method: config.method, headers, body })
    return classifyHttpResult(res.status)
  } catch (err) {
    return networkFailure(err)
  }
}
