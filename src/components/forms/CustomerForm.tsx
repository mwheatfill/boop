import { useForm } from '@tanstack/react-form'
import { useRef } from 'react'
import { SlugField } from '@/components/SlugField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FieldErrors } from '@/lib/errors'
import type { MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import type { Customer, CustomerCreateInput, CustomerUpdateInput } from '@/shared/schemas/customer'

interface CustomerFormProps {
  variant: 'create' | 'edit'
  initialValues: {
    name: string
    slug: string
    timezone: string
    autotaskCompanyId: string
  }
  submitLabel: string
  mutate: (
    value: CustomerCreateInput | (CustomerUpdateInput & { slug: string }),
  ) => Promise<MutationResult<Customer>>
  onSuccess: (data: Customer) => Promise<void> | void
}

function fieldErrorsToTanstack(fieldErrors: FieldErrors | undefined): Record<string, string> {
  if (!fieldErrors) return {}
  const out: Record<string, string> = {}
  for (const [key, msgs] of Object.entries(fieldErrors)) {
    if (msgs[0]) out[key] = msgs[0]
  }
  return out
}

export function CustomerForm({
  variant,
  initialValues,
  submitLabel,
  mutate,
  onSuccess,
}: CustomerFormProps) {
  const slugManuallyEdited = useRef(variant === 'edit')

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmitAsync: async ({ value }) => {
        const payload =
          variant === 'create'
            ? {
                name: value.name,
                slug: value.slug,
                timezone: value.timezone,
                ...(value.autotaskCompanyId ? { autotaskCompanyId: value.autotaskCompanyId } : {}),
              }
            : {
                slug: initialValues.slug,
                name: value.name,
                timezone: value.timezone,
                ...(value.autotaskCompanyId ? { autotaskCompanyId: value.autotaskCompanyId } : {}),
              }
        const result = await mutate(payload as never)
        if (!result.ok) {
          return {
            ...(result.message ? { form: result.message } : {}),
            fields: fieldErrorsToTanstack(result.fieldErrors),
          }
        }
        await onSuccess(result.data)
        return null
      },
    },
  })

  return (
    <form
      className="flex max-w-xl flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field
        name="name"
        listeners={{
          onChange: ({ value }) => {
            if (slugManuallyEdited.current) return
            form.setFieldValue('slug', slugify(value))
          },
        }}
      >
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>Name</Label>
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.currentTarget.value)}
            />
            {field.state.meta.errors[0] ? (
              <p className="text-xs text-destructive">{String(field.state.meta.errors[0])}</p>
            ) : null}
          </div>
        )}
      </form.Field>

      <form.Field name="slug">
        {(field) => (
          <SlugField
            id={field.name}
            name={field.name}
            value={field.state.value}
            readOnly={variant === 'edit'}
            error={field.state.meta.errors[0] ? String(field.state.meta.errors[0]) : undefined}
            onChange={(next) => {
              slugManuallyEdited.current = true
              field.handleChange(next)
            }}
            helpText={
              variant === 'create'
                ? 'Auto-filled from name. Read-only after create.'
                : 'Slug is immutable after create.'
            }
          />
        )}
      </form.Field>

      <form.Field name="timezone">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>Timezone</Label>
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              placeholder="America/New_York"
              onChange={(e) => field.handleChange(e.currentTarget.value)}
            />
            <p className="text-xs text-muted-foreground">IANA timezone identifier.</p>
            {field.state.meta.errors[0] ? (
              <p className="text-xs text-destructive">{String(field.state.meta.errors[0])}</p>
            ) : null}
          </div>
        )}
      </form.Field>

      <form.Field name="autotaskCompanyId">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>Autotask company id (optional)</Label>
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.currentTarget.value)}
            />
          </div>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => [s.isSubmitting, s.errorMap.onSubmit] as const}>
        {([isSubmitting, formError]) => (
          <div className="flex flex-col gap-2">
            {formError ? <p className="text-sm text-destructive">{String(formError)}</p> : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  )
}
