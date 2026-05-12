import { autocompletion, CompletionContext } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { makeVariableCompletionSource } from './variable-completion-source'

function contextAt(doc: string, pos: number, explicit = true): CompletionContext {
  const state = EditorState.create({ doc, extensions: [autocompletion()] })
  return new CompletionContext(state, pos, explicit)
}

describe('makeVariableCompletionSource', () => {
  it('suggests built-in variables inside {{ }}', () => {
    const src = makeVariableCompletionSource()
    const ctx = contextAt('{{ ', 3)
    const result = src(ctx)
    expect(result).not.toBeNull()
    const labels = result?.options.map((o) => o.label) ?? []
    expect(labels).toContain('run_id')
    expect(labels).toContain('customer_name')
    expect(labels).toContain('now')
  })

  it('suggests Liquid control tags inside {% %}', () => {
    const src = makeVariableCompletionSource()
    const ctx = contextAt('{% ', 3)
    const result = src(ctx)
    expect(result).not.toBeNull()
    const labels = result?.options.map((o) => o.label) ?? []
    expect(labels).toContain('if')
    expect(labels).toContain('for')
    expect(labels).toContain('boop_secret')
  })

  it('includes operator-defined variables alongside built-ins', () => {
    const src = makeVariableCompletionSource({
      variables: [
        { name: 'tenant_id', value: 'acme-123', source: 'customer' },
        { name: 'region', value: 'us-east', source: 'job' },
      ],
    })
    const ctx = contextAt('{{ ', 3)
    const result = src(ctx)
    const labels = result?.options.map((o) => o.label) ?? []
    expect(labels).toContain('tenant_id')
    expect(labels).toContain('region')
    expect(labels).toContain('run_id')
  })

  it('suggests secret names inside the boop_secret arg', () => {
    const src = makeVariableCompletionSource({
      secrets: [{ name: 'stripe_api_key' }, { name: 'webhook_signing_key' }],
    })
    const doc = '{% boop_secret "'
    const ctx = contextAt(doc, doc.length)
    const result = src(ctx)
    expect(result).not.toBeNull()
    const labels = result?.options.map((o) => o.label) ?? []
    expect(labels).toEqual(['stripe_api_key', 'webhook_signing_key'])
  })

  it('returns null outside any Liquid construct', () => {
    const src = makeVariableCompletionSource()
    const ctx = contextAt('plain text ', 11, false)
    expect(src(ctx)).toBeNull()
  })

  it('truncates long variable values in the detail label', () => {
    const longValue = 'x'.repeat(80)
    const src = makeVariableCompletionSource({
      variables: [{ name: 'big', value: longValue, source: 'customer' }],
    })
    const ctx = contextAt('{{ ', 3)
    const result = src(ctx)
    const big = result?.options.find((o) => o.label === 'big')
    expect(big?.detail).toBeDefined()
    expect(big?.detail?.length).toBeLessThan(longValue.length)
    expect(big?.detail).toMatch(/…|from Customer/)
  })
})
