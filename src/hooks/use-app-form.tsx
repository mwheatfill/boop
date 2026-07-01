import { createFormHook, createFormHookContexts } from '@tanstack/react-form'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

// The canonical TanStack Form seam (ADR-013). Field components are pre-bound to
// the form via createFormHook so every form in the app shares one validation,
// error-rendering, and layout treatment. Zod schemas (from @/shared/schemas)
// drive validation; field errors flow into the shadcn FieldError shape.

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

// TanStack Form surfaces validator output on field.state.meta.errors. Standard-schema
// (Zod) issues are objects with a `message`; some validators emit plain strings.
// Normalise both to the { message } shape FieldError consumes.
export function normalizeFieldErrors(errors: ReadonlyArray<unknown>): Array<{ message?: string }> {
  return errors.map((e) => (typeof e === 'string' ? { message: e } : (e as { message?: string })))
}

// Surface field errors only after the field has been touched so pristine forms stay quiet.
function useFieldErrors(): Array<{ message?: string }> {
  const field = useFieldContext()
  if (!field.state.meta.isTouched) return []
  return normalizeFieldErrors(field.state.meta.errors)
}

interface BaseFieldProps {
  label?: ReactNode
  description?: ReactNode
}

function TextField({
  label,
  description,
  type = 'text',
  placeholder,
  autoFocus,
}: BaseFieldProps & {
  type?: string
  placeholder?: string
  autoFocus?: boolean
}) {
  const field = useFieldContext<string>()
  const errors = useFieldErrors()
  return (
    <Field data-invalid={errors.length > 0 || undefined}>
      {label ? <FieldLabel htmlFor={field.name}>{label}</FieldLabel> : null}
      <Input
        id={field.name}
        name={field.name}
        type={type}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-invalid={errors.length > 0 || undefined}
        value={field.state.value ?? ''}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={errors} />
    </Field>
  )
}

function TextareaField({
  label,
  description,
  placeholder,
  rows,
}: BaseFieldProps & { placeholder?: string; rows?: number }) {
  const field = useFieldContext<string>()
  const errors = useFieldErrors()
  return (
    <Field data-invalid={errors.length > 0 || undefined}>
      {label ? <FieldLabel htmlFor={field.name}>{label}</FieldLabel> : null}
      <Textarea
        id={field.name}
        name={field.name}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={errors.length > 0 || undefined}
        value={field.state.value ?? ''}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={errors} />
    </Field>
  )
}

function SelectField({
  label,
  description,
  placeholder,
  options,
}: BaseFieldProps & {
  placeholder?: string
  options: ReadonlyArray<{ value: string; label: ReactNode }>
}) {
  const field = useFieldContext<string>()
  const errors = useFieldErrors()
  return (
    <Field data-invalid={errors.length > 0 || undefined}>
      {label ? <FieldLabel htmlFor={field.name}>{label}</FieldLabel> : null}
      <Select
        value={field.state.value}
        onValueChange={(v) => field.handleChange(v as string)}
        items={[...options]}
      >
        <SelectTrigger
          id={field.name}
          className="w-full"
          aria-invalid={errors.length > 0 || undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={errors} />
    </Field>
  )
}

function SwitchField({ label, description }: BaseFieldProps) {
  const field = useFieldContext<boolean>()
  const errors = useFieldErrors()
  return (
    <Field orientation="horizontal" data-invalid={errors.length > 0 || undefined}>
      <FieldContent>
        {label ? <FieldLabel htmlFor={field.name}>{label}</FieldLabel> : null}
        {description ? <FieldDescription>{description}</FieldDescription> : null}
        <FieldError errors={errors} />
      </FieldContent>
      <Switch
        id={field.name}
        checked={field.state.value}
        onCheckedChange={(checked) => field.handleChange(checked)}
      />
    </Field>
  )
}

function CheckboxField({ label, description }: BaseFieldProps) {
  const field = useFieldContext<boolean>()
  const errors = useFieldErrors()
  return (
    <Field orientation="horizontal" data-invalid={errors.length > 0 || undefined}>
      <Checkbox
        id={field.name}
        checked={field.state.value}
        onCheckedChange={(checked) => field.handleChange(checked === true)}
        aria-invalid={errors.length > 0 || undefined}
      />
      <FieldContent>
        {label ? <FieldLabel htmlFor={field.name}>{label}</FieldLabel> : null}
        {description ? <FieldDescription>{description}</FieldDescription> : null}
        <FieldError errors={errors} />
      </FieldContent>
    </Field>
  )
}

function RadioGroupField({
  label,
  description,
  options,
}: BaseFieldProps & {
  options: ReadonlyArray<{ value: string; label: ReactNode }>
}) {
  const field = useFieldContext<string>()
  const errors = useFieldErrors()
  return (
    <Field data-invalid={errors.length > 0 || undefined}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <RadioGroup value={field.state.value} onValueChange={(v) => field.handleChange(v as string)}>
        {options.map((o) => (
          <Field key={o.value} orientation="horizontal">
            <RadioGroupItem id={`${field.name}-${o.value}`} value={o.value} />
            <FieldLabel htmlFor={`${field.name}-${o.value}`} className="font-normal">
              {o.label}
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={errors} />
    </Field>
  )
}

// Submit button bound to the form: disables while invalid or in-flight and shows a
// Spinner during submission. Compose with Button (no isPending prop per shadcn rules).
function SubmitButton({ children }: { children: ReactNode }) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}>
      {({ canSubmit, isSubmitting }) => (
        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
          {children}
        </Button>
      )}
    </form.Subscribe>
  )
}

const { useAppForm, withForm } = createFormHook({
  fieldComponents: {
    TextField,
    TextareaField,
    SelectField,
    SwitchField,
    CheckboxField,
    RadioGroupField,
  },
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
})

export { useAppForm, withForm }
