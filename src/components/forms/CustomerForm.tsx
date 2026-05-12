import { useForm } from '@tanstack/react-form'
import { SlugField } from '@/components/SlugField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FieldErrors } from '@/lib/errors'
import type { CustomerCreateInput, CustomerUpdateInput } from '@/shared/schemas/customer'

interface CustomerFormProps {
  variant: 'create' | 'edit'
  initialValues: {
    name: string
    slug: string
    timezone: string
    autotaskCompanyId: string
  }
  submitLabel: string
  onSubmit: (
    value: CustomerCreateInput | (CustomerUpdateInput & { slug: string }),
  ) => Promise<{ ok: true } | { ok: false; fieldErrors?: FieldErrors; message?: string }>
}

function firstError(errors: FieldErrors | undefined, field: string): string | undefined {
  return errors?.[field]?.[0]
}

export function CustomerForm({ variant, initialValues, submitLabel, onSubmit }: CustomerFormProps) {
  const form = useForm({
    defaultValues: {
      ...initialValues,
      _serverFieldErrors: undefined as FieldErrors | undefined,
      _serverMessage: undefined as string | undefined,
    },
    onSubmit: async ({ value, formApi }) => {
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
      const result = await onSubmit(payload as never)
      if (!result.ok) {
        formApi.setFieldValue('_serverFieldErrors', result.fieldErrors)
        formApi.setFieldValue('_serverMessage', result.message)
      }
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
      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>Name</Label>
            <Input
              id={field.name}
              name={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.currentTarget.value)}
            />
          </div>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => [s.values.name, s.values._serverFieldErrors] as const}>
        {([name, serverErrors]) => (
          <form.Field name="slug">
            {(field) => (
              <SlugField
                id={field.name}
                name={field.name}
                value={field.state.value}
                derivedFrom={name}
                readOnly={variant === 'edit'}
                error={firstError(serverErrors, 'slug')}
                onChange={(next) => field.handleChange(next)}
                helpText={
                  variant === 'create'
                    ? 'Auto-filled from name. Read-only after create.'
                    : 'Slug is immutable after create.'
                }
              />
            )}
          </form.Field>
        )}
      </form.Subscribe>

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

      <form.Subscribe selector={(s) => [s.isSubmitting, s.values._serverMessage] as const}>
        {([isSubmitting, serverMessage]) => (
          <div className="flex flex-col gap-2">
            {serverMessage ? <p className="text-sm text-destructive">{serverMessage}</p> : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  )
}
