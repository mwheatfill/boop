import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import {
  BUILTIN_RENDER_VARIABLE_NAMES,
  type BuiltinRenderVariableName,
} from '@/lib/dispatch/render'

export interface VariableCompletion {
  name: string
  value?: string
  source: 'builtin' | 'workspace' | 'job'
}

export interface SecretCompletion {
  name: string
}

export interface VariableCompletionSourceInput {
  variables?: VariableCompletion[]
  secrets?: SecretCompletion[]
}

const BUILTIN_PREVIEW_VALUES: Record<BuiltinRenderVariableName, string> = {
  run_id: 'run_preview',
  attempt_number: '1',
  workspace_name: 'Acme Corp',
  workspace_timezone: 'UTC',
  now: '<Date>',
}

const BUILTIN_VARIABLES: readonly VariableCompletion[] = BUILTIN_RENDER_VARIABLE_NAMES.map(
  (name) => ({ name, value: BUILTIN_PREVIEW_VALUES[name], source: 'builtin' }),
)

const BOOST_BY_SOURCE: Record<VariableCompletion['source'], number> = {
  builtin: 1,
  workspace: 2,
  job: 3,
}

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
const SECRET_ARG_RE = /{%\s*boop_secret\s+(["'])([^"']*)$/

const EMPTY_VARIABLES: VariableCompletion[] = []
const EMPTY_SECRETS: SecretCompletion[] = []

function truncate(value: string, max = 32): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function sourceLabel(source: VariableCompletion['source']): string {
  switch (source) {
    case 'builtin':
      return 'built-in'
    case 'workspace':
      return 'from Workspace'
    case 'job':
      return 'from Job'
  }
}

function variableCompletion(v: VariableCompletion): Completion {
  const detail =
    v.value !== undefined
      ? `${truncate(v.value)} · ${sourceLabel(v.source)}`
      : sourceLabel(v.source)
  return { label: v.name, type: 'variable', detail, boost: BOOST_BY_SOURCE[v.source] }
}

function tagCompletion(name: string): Completion {
  return { label: name, type: 'keyword', detail: 'tag' }
}

function secretCompletion(s: SecretCompletion): Completion {
  return { label: s.name, type: 'text', detail: 'secret' }
}

function insideOpenDelim(before: string, open: string, close: string): boolean {
  return before.lastIndexOf(open) > before.lastIndexOf(close)
}

function wordCompletion(
  ctx: CompletionContext,
  options: readonly Completion[],
): CompletionResult | null {
  const word = ctx.matchBefore(VARIABLE_NAME_RE)
  if (!word && !ctx.explicit) return null
  return {
    from: word ? word.from : ctx.pos,
    options: options as Completion[],
    validFor: VARIABLE_NAME_RE,
  }
}

function matchSecretArg(before: string): { from: number } | null {
  const m = before.match(SECRET_ARG_RE)
  if (!m || m.index === undefined) return null
  return { from: m.index + m[0].length - (m[2]?.length ?? 0) }
}

export function makeVariableCompletionSource({
  variables = EMPTY_VARIABLES,
  secrets = EMPTY_SECRETS,
}: VariableCompletionSourceInput = {}) {
  const variableOptions: readonly Completion[] = [...BUILTIN_VARIABLES, ...variables].map(
    variableCompletion,
  )
  const tagOptions: readonly Completion[] = LIQUID_TAGS.map(tagCompletion)
  const secretOptions: readonly Completion[] = secrets.map(secretCompletion)

  return (ctx: CompletionContext): CompletionResult | null => {
    const before = ctx.state.sliceDoc(0, ctx.pos)

    const secretArg = matchSecretArg(before)
    if (secretArg) {
      return {
        from: secretArg.from,
        options: secretOptions as Completion[],
        validFor: /^[a-z0-9_-]*$/i,
      }
    }

    if (insideOpenDelim(before, '{{', '}}')) return wordCompletion(ctx, variableOptions)
    if (insideOpenDelim(before, '{%', '%}')) return wordCompletion(ctx, tagOptions)
    return null
  }
}
