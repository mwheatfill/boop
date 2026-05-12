import { useForm } from '@tanstack/react-form'
import { useRef } from 'react'
import { SlugField } from '@/components/SlugField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import type { Target, TargetCreateInput, TargetUpdateInput } from '@/shared/schemas/target'
import { TARGET_AUTH_KINDS, TARGET_METHODS, TARGET_REACHABILITIES } from '@/shared/schemas/target'

interface TargetFormProps {
  variant: 'create' | 'edit'
  initialValues: {
    name: string
    slug: string
    url: string
    method: (typeof TARGET_METHODS)[number]
    authKind: (typeof TARGET_AUTH_KINDS)[number]
    authConfig: string
    reachability: (typeof TARGET_REACHABILITIES)[number]
  }
  submitLabel: string
  mutate: (value: TargetCreateInput | TargetUpdateInput) => Promise<MutationResult<Target>>
  onSuccess: (data: Target) => Promise<void> | void
}

export function TargetForm({
  variant,
  initialValues,
  submitLabel,
  mutate,
  onSuccess,
}: TargetFormProps) {
  const slugManuallyEdited = useRef(variant === 'edit')

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmitAsync: async ({ value }) => {
        const baseMutable = {
          name: value.name,
          url: value.url,
          method: value.method,
          authKind: value.authKind,
          ...(value.authConfig ? { authConfig: value.authConfig } : { authConfig: null }),
          reachability: value.reachability,
        }
        const payload = variant === 'create' ? { ...baseMutable, slug: value.slug } : baseMutable
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

      <form.Field name="url">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>URL</Label>
            <Input
              id={field.name}
              name={field.name}
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

      <form.Field name="method">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>HTTP method</Label>
            <Select
              value={field.state.value}
              onValueChange={(v) => field.handleChange(v as (typeof TARGET_METHODS)[number])}
            >
              <SelectTrigger id={field.name}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      <form.Field name="authKind">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>Auth</Label>
            <Select
              value={field.state.value}
              onValueChange={(v) => field.handleChange(v as (typeof TARGET_AUTH_KINDS)[number])}
            >
              <SelectTrigger id={field.name}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_AUTH_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      <form.Subscribe selector={(s) => s.values.authKind}>
        {(authKind) =>
          authKind === 'none' ? null : (
            <form.Field name="authConfig">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={field.name}>Auth config</Label>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.currentTarget.value)}
                    placeholder={
                      authKind === 'bearer'
                        ? 'Bearer token'
                        : authKind === 'basic'
                          ? 'user:password'
                          : '{ "X-Api-Key": "..." }'
                    }
                  />
                </div>
              )}
            </form.Field>
          )
        }
      </form.Subscribe>

      <form.Field name="reachability">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor={field.name}>Reachability</Label>
            <Select
              value={field.state.value}
              onValueChange={(v) => field.handleChange(v as (typeof TARGET_REACHABILITIES)[number])}
            >
              <SelectTrigger id={field.name}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_REACHABILITIES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
