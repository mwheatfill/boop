import { describe, expect, it } from 'vitest'
import { previewBody, previewHeaders, syntheticRenderContext } from './render-preview'

const baseContext = syntheticRenderContext({
  workspaceName: 'Acme',
  workspaceTimezone: 'UTC',
  now: new Date('2026-05-12T15:30:00.000Z'),
})

describe('previewBody', () => {
  it('renders a template against the synthetic context', async () => {
    const result = await previewBody(
      'Hello {{ workspace_name }} from run {{ run_id }}',
      baseContext,
    )
    expect(result.rendered).toBe('Hello Acme from run run_preview')
    expect(result.error).toBeUndefined()
  })

  it('surfaces a Liquid render error as a string', async () => {
    const result = await previewBody('{{ now | bogus_filter }}', baseContext)
    expect(result.error).toBeDefined()
    expect(result.rendered).toBe('')
  })

  it('redacts boop_secret to <<secret:name>> in preview mode', async () => {
    const result = await previewBody('Bearer {% boop_secret "stripe" %}', baseContext)
    expect(result.error).toBeUndefined()
    expect(result.rendered).toBe('Bearer <<secret:stripe>>')
  })

  it('returns an empty rendered string with no error for an empty template', async () => {
    const result = await previewBody('', baseContext)
    expect(result.rendered).toBe('')
    expect(result.error).toBeUndefined()
  })
})

describe('previewHeaders', () => {
  it('parses a valid JSON headers template into Record<string,string>', async () => {
    const result = await previewHeaders(
      '{ "X-Run": "{{ run_id }}", "X-Workspace": "{{ workspace_name }}" }',
      baseContext,
    )
    expect(result.error).toBeUndefined()
    expect(result.headers).toEqual({
      'X-Run': 'run_preview',
      'X-Workspace': 'Acme',
    })
  })

  it('surfaces a Liquid render error', async () => {
    const result = await previewHeaders('{{ now | bogus_filter }}', baseContext)
    expect(result.error).toBeDefined()
    expect(result.rendered).toBe('')
    expect(result.headers).toBeUndefined()
  })

  it('surfaces a JSON parse error after a successful render', async () => {
    const result = await previewHeaders('{ "broken": ', baseContext)
    expect(result.error).toMatch(/valid JSON/i)
    expect(result.rendered).toBe('{ "broken": ')
    expect(result.headers).toBeUndefined()
  })

  it('rejects headers that are not a plain object', async () => {
    const result = await previewHeaders('["a", "b"]', baseContext)
    expect(result.error).toMatch(/JSON object/i)
    expect(result.headers).toBeUndefined()
  })

  it('rejects header values that are not strings', async () => {
    const result = await previewHeaders('{ "X-Bad": 42 }', baseContext)
    expect(result.error).toMatch(/must be a string/i)
    expect(result.headers).toBeUndefined()
  })
})
