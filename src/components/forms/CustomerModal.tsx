import { useForm, useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useRef } from 'react'
import { toast } from 'sonner'
import { EntityModal } from '@/components/forms/EntityModal'
import { Input } from '@/components/ui/input'
import { createCustomerFn, updateCustomerFn } from '@/lib/customers/server-fns'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import type { Customer } from '@/shared/schemas/customer'

interface CustomerFormValues {
  name: string
  slug: string
  timezone: string
  autotaskCompanyId: string
}

interface CreateProps {
  variant: 'create'
  onClose: () => void
}

interface EditProps {
  variant: 'edit'
  initialCustomer: Customer
  onClose: () => void
}

type CustomerModalProps = CreateProps | EditProps

export function CustomerModal(props: CustomerModalProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const slugManuallyEdited = useRef(props.variant === 'edit')

  const initial: CustomerFormValues =
    props.variant === 'edit'
      ? {
          name: props.initialCustomer.name,
          slug: props.initialCustomer.slug,
          timezone: props.initialCustomer.timezone,
          autotaskCompanyId: props.initialCustomer.autotaskCompanyId ?? '',
        }
      : { name: '', slug: '', timezone: 'America/New_York', autotaskCompanyId: '' }

  const form = useForm({
    defaultValues: initial,
    validators: {
      onSubmitAsync: async ({ value }) => {
        const payload =
          props.variant === 'create'
            ? {
                name: value.name,
                slug: value.slug,
                timezone: value.timezone,
                ...(value.autotaskCompanyId ? { autotaskCompanyId: value.autotaskCompanyId } : {}),
              }
            : {
                slug: props.initialCustomer.slug,
                name: value.name,
                timezone: value.timezone,
                ...(value.autotaskCompanyId ? { autotaskCompanyId: value.autotaskCompanyId } : {}),
              }

        const result: MutationResult<Customer> =
          props.variant === 'create'
            ? await createCustomerFn({ data: payload as never })
            : await updateCustomerFn({ data: payload as never })

        if (!result.ok) {
          return {
            ...(result.message ? { form: result.message } : {}),
            fields: fieldErrorsToTanstack(result.fieldErrors),
          }
        }

        await queryClient.invalidateQueries({ queryKey: ['customers'] })
        toast.success(props.variant === 'create' ? `Customer ${result.data.name} created` : 'Saved')

        await navigate({
          to: '/customers/$customerSlug',
          params: { customerSlug: result.data.slug },
        })
        return null
      },
    },
  })

  const isDirty = useStore(form.store, (s) => s.isDirty)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)
  const formError = useStore(form.store, (s) => s.errorMap.onSubmit)

  return (
    <EntityModal
      open
      onClose={props.onClose}
      title={props.variant === 'create' ? 'New Customer' : `Edit ${props.initialCustomer.name}`}
      dirty={isDirty && !isSubmitting}
      primaryAction={{
        label: props.variant === 'create' ? 'Create Customer' : 'Save changes',
        onClick: () => void form.handleSubmit(),
        loading: isSubmitting,
      }}
    >
      <form
        className="flex flex-col gap-4"
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
            <div className="flex flex-col gap-1">
              <Input
                id={field.name}
                value={field.state.value}
                placeholder="Name this Customer…"
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                autoFocus
                className="h-auto border-0 bg-transparent px-0 text-xl font-medium tracking-tight shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
              />
              <form.Field name="slug">
                {(slugField) => (
                  <input
                    type="text"
                    value={slugField.state.value}
                    readOnly={props.variant === 'edit'}
                    onChange={(e) => {
                      slugManuallyEdited.current = true
                      slugField.handleChange(e.currentTarget.value)
                    }}
                    aria-label="Slug"
                    placeholder="slug"
                    className="border-0 bg-transparent px-0 font-mono text-xs text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                  />
                )}
              </form.Field>
              {props.variant === 'edit' ? (
                <p className="text-xs text-muted-foreground/70">
                  Slug can't change after creation.
                </p>
              ) : null}
            </div>
          )}
        </form.Field>

        <form.Field name="timezone">
          {(field) => (
            <div className="flex flex-col gap-2">
              <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                Timezone
              </label>
              <Input
                id={field.name}
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
              <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                Autotask company id (optional)
              </label>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
              />
            </div>
          )}
        </form.Field>

        {formError ? <p className="text-sm text-destructive">{String(formError)}</p> : null}
      </form>
    </EntityModal>
  )
}
