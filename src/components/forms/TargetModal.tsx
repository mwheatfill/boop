import { useForm, useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { EntityModal } from '@/components/forms/EntityModal'
import { PillButton } from '@/components/forms/PillPicker'
import { useSlugAutoFill } from '@/components/forms/use-slug-auto-fill'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import { createTargetFn, updateTargetFn } from '@/lib/targets/server-fns'
import {
  TARGET_AUTH_KINDS,
  TARGET_METHODS,
  TARGET_REACHABILITIES,
  type Target,
} from '@/shared/schemas/target'

interface TargetFormValues {
  name: string
  slug: string
  url: string
  method: (typeof TARGET_METHODS)[number]
  authKind: (typeof TARGET_AUTH_KINDS)[number]
  authConfig: string
  reachability: (typeof TARGET_REACHABILITIES)[number]
}

interface CreateProps {
  variant: 'create'
  customerSlug: string
  onClose: () => void
  /** Called instead of navigating when used as a nested dialog inside JobModal. */
  onCreated?: (target: Target) => void | Promise<void>
}

interface EditProps {
  variant: 'edit'
  customerSlug: string
  initialTarget: Target
  onClose: () => void
}

type TargetModalProps = CreateProps | EditProps

export function TargetModal(props: TargetModalProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const slug = useSlugAutoFill(props.variant === 'edit')

  const initial: TargetFormValues =
    props.variant === 'edit'
      ? {
          name: props.initialTarget.name,
          slug: props.initialTarget.slug,
          url: props.initialTarget.url,
          method: props.initialTarget.method,
          authKind: props.initialTarget.authKind,
          authConfig: props.initialTarget.authConfig ?? '',
          reachability: props.initialTarget.reachability,
        }
      : {
          name: '',
          slug: '',
          url: '',
          method: 'GET',
          authKind: 'none',
          authConfig: '',
          reachability: 'public',
        }

  const form = useForm({
    defaultValues: initial,
    validators: {
      onSubmitAsync: async ({ value }) => {
        const base = {
          name: value.name,
          url: value.url,
          method: value.method,
          authKind: value.authKind,
          ...(value.authConfig ? { authConfig: value.authConfig } : { authConfig: null }),
          reachability: value.reachability,
        }

        const result: MutationResult<Target> =
          props.variant === 'create'
            ? await createTargetFn({
                data: { customerSlug: props.customerSlug, ...base, slug: value.slug } as never,
              })
            : await updateTargetFn({
                data: {
                  customerSlug: props.customerSlug,
                  targetSlug: props.initialTarget.slug,
                  ...base,
                } as never,
              })

        if (!result.ok) {
          return {
            ...(result.message ? { form: result.message } : {}),
            fields: fieldErrorsToTanstack(result.fieldErrors),
          }
        }

        await queryClient.invalidateQueries({
          queryKey: ['customers', props.customerSlug, 'targets'],
        })

        if (props.variant === 'create' && props.onCreated) {
          await props.onCreated(result.data)
          return null
        }

        toast.success(props.variant === 'create' ? `Target ${result.data.name} created` : 'Saved')
        await navigate({
          to: '/customers/$customerSlug',
          params: { customerSlug: props.customerSlug },
        })
        return null
      },
    },
  })

  const isDirty = useStore(form.store, (s) => s.isDirty)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)
  const method = useStore(form.store, (s) => s.values.method)
  const authKind = useStore(form.store, (s) => s.values.authKind)
  const reachability = useStore(form.store, (s) => s.values.reachability)
  const formError = useStore(form.store, (s) => s.errorMap.onSubmit)

  const [methodOpen, setMethodOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [reachOpen, setReachOpen] = useState(false)

  return (
    <EntityModal
      open
      onClose={props.onClose}
      title={props.variant === 'create' ? 'New Target' : `Edit ${props.initialTarget.name}`}
      dirty={isDirty && !isSubmitting}
      primaryAction={{
        label: props.variant === 'create' ? 'Create Target' : 'Save changes',
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
              if (slug.isManual()) return
              form.setFieldValue('slug', slugify(value))
            },
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-1">
              <Input
                id={field.name}
                value={field.state.value}
                placeholder="Name this Target…"
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
                      slug.markManual()
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

        <form.Field name="url">
          {(field) => (
            <div className="flex flex-col gap-2">
              <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                URL
              </label>
              <Input
                id={field.name}
                type="url"
                value={field.state.value}
                placeholder="https://api.example.com/healthz"
                onChange={(e) => field.handleChange(e.currentTarget.value)}
              />
              {field.state.meta.errors[0] ? (
                <p className="text-xs text-destructive">{String(field.state.meta.errors[0])}</p>
              ) : null}
            </div>
          )}
        </form.Field>

        <div className="flex flex-wrap items-center gap-2">
          <Popover open={methodOpen} onOpenChange={setMethodOpen}>
            <PopoverTrigger render={<PillButton label="Method" value={method} state="filled" />} />
            <PopoverContent className="w-48 p-1">
              <ul className="flex flex-col gap-px">
                {TARGET_METHODS.map((m) => (
                  <li key={m}>
                    <button
                      type="button"
                      className="flex w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        form.setFieldValue('method', m)
                        setMethodOpen(false)
                      }}
                    >
                      {m}
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>

          <Popover open={authOpen} onOpenChange={setAuthOpen}>
            <PopoverTrigger render={<PillButton label="Auth" value={authKind} state="filled" />} />
            <PopoverContent className="w-48 p-1">
              <ul className="flex flex-col gap-px">
                {TARGET_AUTH_KINDS.map((a) => (
                  <li key={a}>
                    <button
                      type="button"
                      className="flex w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        form.setFieldValue('authKind', a)
                        setAuthOpen(false)
                      }}
                    >
                      {a}
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>

          <Popover open={reachOpen} onOpenChange={setReachOpen}>
            <PopoverTrigger
              render={<PillButton label="Reachability" value={reachability} state="filled" />}
            />
            <PopoverContent className="w-48 p-1">
              <ul className="flex flex-col gap-px">
                {TARGET_REACHABILITIES.map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      className="flex w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        form.setFieldValue('reachability', r)
                        setReachOpen(false)
                      }}
                    >
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </div>

        {authKind !== 'none' ? (
          <form.Field name="authConfig">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                  Auth config
                </label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  placeholder={
                    authKind === 'bearer'
                      ? 'Bearer token'
                      : authKind === 'basic'
                        ? 'user:password'
                        : '{ "X-Api-Key": "..." }'
                  }
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>
            )}
          </form.Field>
        ) : null}

        {formError ? <p className="text-sm text-destructive">{String(formError)}</p> : null}
      </form>
    </EntityModal>
  )
}
