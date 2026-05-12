import { useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { slugify } from '@/lib/slug/slugify'

interface SlugFieldProps {
  id?: string
  name?: string
  value: string
  derivedFrom: string
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
  derivedFrom,
  onChange,
  readOnly = false,
  error,
  label = 'Slug',
  helpText,
}: SlugFieldProps) {
  const dirtyRef = useRef(value.length > 0)

  useEffect(() => {
    if (readOnly || dirtyRef.current) return
    onChange(slugify(derivedFrom))
  }, [derivedFrom, onChange, readOnly])

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        value={value}
        readOnly={readOnly}
        aria-invalid={error ? 'true' : undefined}
        onChange={(event) => {
          dirtyRef.current = true
          onChange(event.currentTarget.value)
        }}
      />
      {helpText && !error ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
