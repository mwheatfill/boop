import { useEffect, useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { previewBody, previewHeaders, syntheticRenderContext } from '@/lib/dispatch/render-preview'

interface TemplateEditorProps {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  variant: 'body' | 'headers'
  customerName: string
  customerTimezone: string
  helpText?: string
  rows?: number
}

const DEBOUNCE_MS = 200

export function TemplateEditor({
  id,
  label,
  value,
  onChange,
  variant,
  customerName,
  customerTimezone,
  helpText,
  rows = 6,
}: TemplateEditorProps) {
  const context = useMemo(
    () => syntheticRenderContext({ customerName, customerTimezone }),
    [customerName, customerTimezone],
  )
  const [rendered, setRendered] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let canceled = false
    const timer = setTimeout(async () => {
      const result =
        variant === 'headers'
          ? await previewHeaders(value, context)
          : await previewBody(value, context)
      if (canceled) return
      setRendered(result.rendered)
      setError(result.error)
    }, DEBOUNCE_MS)
    return () => {
      canceled = true
      clearTimeout(timer)
    }
  }, [value, variant, context])

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          rows={rows}
          className="font-mono text-xs"
        />
        <div
          aria-live="polite"
          className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Preview
          </p>
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
              {rendered || <span className="text-muted-foreground">(empty)</span>}
            </pre>
          )}
        </div>
      </div>
      {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
    </div>
  )
}
