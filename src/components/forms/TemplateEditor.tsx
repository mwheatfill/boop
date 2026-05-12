import { autocompletion } from '@codemirror/autocomplete'
import { liquid } from '@codemirror/lang-liquid'
import { linter, lintGutter } from '@codemirror/lint'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { boopTheme } from './codemirror-theme'
import { liquidLintSource } from './liquid-lint'
import { useLiquidPreview } from './use-liquid-preview'
import {
  makeVariableCompletionSource,
  type SecretCompletion,
  type VariableCompletion,
} from './variable-completion-source'

interface TemplateEditorProps {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  variant: 'body' | 'headers'
  customerName: string
  customerTimezone: string
  helpText?: string
  height?: string
  readOnly?: boolean
  variables?: VariableCompletion[]
  secrets?: SecretCompletion[]
}

const DEFAULT_HEIGHT = '240px'

export function TemplateEditor({
  id,
  label,
  value,
  onChange,
  variant,
  customerName,
  customerTimezone,
  helpText,
  height = DEFAULT_HEIGHT,
  readOnly = false,
  variables,
  secrets,
}: TemplateEditorProps) {
  const preview = useLiquidPreview({
    template: value,
    customerName,
    customerTimezone,
    variant,
  })

  const extensions = useMemo(
    () => [
      liquid(),
      autocompletion({
        override: [
          makeVariableCompletionSource({
            ...(variables ? { variables } : {}),
            ...(secrets ? { secrets } : {}),
          }),
        ],
        activateOnTyping: true,
      }),
      linter(liquidLintSource, { delay: 250 }),
      lintGutter(),
      EditorView.lineWrapping,
    ],
    [variables, secrets],
  )

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid gap-2 md:grid-cols-[3fr_2fr]">
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <CodeMirror
            value={value}
            height={height}
            theme={boopTheme}
            extensions={extensions}
            onChange={onChange}
            editable={!readOnly}
            readOnly={readOnly}
            basicSetup={{
              lineNumbers: false,
              foldGutter: false,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
              dropCursor: !readOnly,
              indentOnInput: true,
              bracketMatching: true,
              closeBrackets: !readOnly,
              autocompletion: false,
            }}
            aria-label={label}
            id={id}
          />
        </div>
        <div
          aria-live="polite"
          className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Preview
          </p>
          {preview.error ? (
            <p className="text-xs text-destructive">{preview.error}</p>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
              {preview.rendered || <span className="text-muted-foreground">(empty)</span>}
            </pre>
          )}
        </div>
      </div>
      {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
    </div>
  )
}
