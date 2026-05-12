import { Liquid } from 'liquidjs'
import type { AlertContext } from '@/shared/schemas/alert-context'

const engine = new Liquid({
  strictFilters: true,
  strictVariables: false,
  greedy: false,
})

export async function renderAlertTemplate(
  template: string,
  context: AlertContext,
): Promise<string> {
  return engine.parseAndRender(template, {
    ...context,
    alert_context_json: JSON.stringify(context),
  })
}
