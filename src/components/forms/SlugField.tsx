import type { AnyFieldApi } from '@tanstack/react-form'
import type { ReactNode } from 'react'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { normalizeFieldErrors } from '@/hooks/use-app-form'

// DESIGN.md § 6 (Forms): the shared slug control. Renders the shadcn Field + the
// Input primitive (never a raw <input>), owns immutability on edit, hands off to
// the name-derived auto-fill, and surfaces the server uniqueness error the way the
// form seam surfaces field errors. Takes the TanStack field explicitly so it serves
// both the useAppForm sheets and the plain useForm modal.

interface SlugFieldProps {
  field: AnyFieldApi
  /** True on edit: the slug is immutable once the entity exists. */
  readOnly?: boolean
  /** The name→slug auto-fill handle; a direct edit marks the slug as manually set. */
  autoFill?: { markManual: () => void }
  placeholder?: string
  label?: ReactNode
}

export function SlugField({
  field,
  readOnly,
  autoFill,
  placeholder,
  label = 'Slug',
}: SlugFieldProps) {
  const errors = field.state.meta.isTouched ? normalizeFieldErrors(field.state.meta.errors) : []
  return (
    <Field data-invalid={errors.length > 0 || undefined}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        id={field.name}
        name={field.name}
        readOnly={readOnly}
        placeholder={placeholder}
        aria-invalid={errors.length > 0 || undefined}
        className="font-mono text-xs read-only:text-muted-foreground md:text-xs"
        value={field.state.value ?? ''}
        onChange={(e) => {
          autoFill?.markManual()
          field.handleChange(e.target.value)
        }}
        onBlur={field.handleBlur}
      />
      <FieldDescription>
        {readOnly ? "Slug can't change after creation." : 'Used in URLs and the API.'}
      </FieldDescription>
      <FieldError errors={errors} />
    </Field>
  )
}
