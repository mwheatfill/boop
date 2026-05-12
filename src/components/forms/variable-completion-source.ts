import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'

export interface VariableCompletion {
  name: string
  value?: string
  source: 'builtin' | 'customer' | 'job'
}

export interface SecretCompletion {
  name: string
}

export interface VariableCompletionSourceInput {
  variables?: VariableCompletion[]
  secrets?: SecretCompletion[]
}

export const BUILTIN_VARIABLES: readonly VariableCompletion[] = [
  { name: 'run_id', value: 'run_preview', source: 'builtin' },
  { name: 'attempt_number', value: '1', source: 'builtin' },
  { name: 'customer_name', value: 'Acme Corp', source: 'builtin' },
  { name: 'customer_timezone', value: 'UTC', source: 'builtin' },
  { name: 'now', value: '<Date>', source: 'builtin' },
]

const LIQUID_TAGS: readonly string[] = [
  'if',
  'elsif',
  'else',
  'endif',
  'unless',
  'endunless',
  'for',
  'endfor',
  'break',
  'continue',
  'case',
  'when',
  'endcase',
  'assign',
  'capture',
  'endcapture',
  'comment',
  'endcomment',
  'raw',
  'endraw',
  'boop_secret',
]

const VARIABLE_NAME_RE = /[A-Za-z_][A-Za-z0-9_]*/

function truncate(value: string, max = 32): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function sourceLabel(source: VariableCompletion['source']): string {
  switch (source) {
    case 'builtin':
      return 'built-in'
    case 'customer':
      return 'from Customer'
    case 'job':
      return 'from Job'
  }
}

function variableCompletion(v: VariableCompletion): Completion {
  const detail =
    v.value !== undefined
      ? `${truncate(v.value)} · ${sourceLabel(v.source)}`
      : sourceLabel(v.source)
  return {
    label: v.name,
    type: 'variable',
    detail,
    boost: v.source === 'builtin' ? 1 : v.source === 'job' ? 3 : 2,
  }
}

function tagCompletion(name: string): Completion {
  return { label: name, type: 'keyword', detail: 'tag' }
}

function secretCompletion(s: SecretCompletion): Completion {
  return { label: s.name, type: 'text', detail: 'secret' }
}

function inOpenExpression(before: string): boolean {
  const lastOpen = before.lastIndexOf('{{')
  const lastClose = before.lastIndexOf('}}')
  return lastOpen > lastClose
}

function inOpenTag(before: string): boolean {
  const lastOpen = before.lastIndexOf('{%')
  const lastClose = before.lastIndexOf('%}')
  return lastOpen > lastClose
}

function matchSecretArg(before: string): { from: number } | null {
  const m = before.match(/{%\s*boop_secret\s+(["'])([^"']*)$/)
  if (!m) return null
  const quote = m[1]
  if (!quote) return null
  const quoteIdx = before.lastIndexOf(quote)
  return { from: quoteIdx + 1 }
}

export function makeVariableCompletionSource({
  variables = [],
  secrets = [],
}: VariableCompletionSourceInput = {}) {
  const allVariables = [...BUILTIN_VARIABLES, ...variables]

  return (ctx: CompletionContext): CompletionResult | null => {
    const before = ctx.state.sliceDoc(0, ctx.pos)

    const secretArg = matchSecretArg(before)
    if (secretArg) {
      return {
        from: secretArg.from,
        options: secrets.map(secretCompletion),
        validFor: /^[a-z0-9_-]*$/i,
      }
    }

    if (inOpenExpression(before)) {
      const word = ctx.matchBefore(VARIABLE_NAME_RE)
      const from = word ? word.from : ctx.pos
      if (!word && !ctx.explicit) return null
      return {
        from,
        options: allVariables.map(variableCompletion),
        validFor: VARIABLE_NAME_RE,
      }
    }

    if (inOpenTag(before)) {
      const word = ctx.matchBefore(VARIABLE_NAME_RE)
      const from = word ? word.from : ctx.pos
      if (!word && !ctx.explicit) return null
      return {
        from,
        options: LIQUID_TAGS.map(tagCompletion),
        validFor: VARIABLE_NAME_RE,
      }
    }

    return null
  }
}
