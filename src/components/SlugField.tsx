import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SlugFieldProps {
  id?: string
  name?: string
  value: string
  onChange: (next: string) => void
  readOnly?: boolean
  error?: string | undefined
  label?: string
  helpText?: string
}

export function SlugField({
  id = 'slug',
  name = 'slug',
  value,
  onChange,
  readOnly = false,
  error,
  label = 'Slug',
  helpText,
}: SlugFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        value={value}
        readOnly={readOnly}
        aria-invalid={error ? 'true' : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {helpText && !error ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
