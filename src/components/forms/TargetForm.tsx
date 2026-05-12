import { useForm } from '@tanstack/react-form'
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
import type { FieldErrors } from '@/lib/errors'
import type { TargetCreateInput, TargetUpdateInput } from '@/shared/schemas/target'
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
  onSubmit: (
    value: TargetCreateInput | TargetUpdateInput,
  ) => Promise<{ ok: true } | { ok: false; fieldErrors?: FieldErrors; message?: string }>
}

function firstError(errors: FieldErrors | undefined, field: string): string | undefined {
  return errors?.[field]?.[0]
}

export function TargetForm({ variant, initialValues, submitLabel, onSubmit }: TargetFormProps) {
  const form = useForm({
    defaultValues: {
      ...initialValues,
      _serverFieldErrors: undefined as FieldErrors | undefined,
      _serverMessage: undefined as string | undefined,
    },
    onSubmit: async ({ value, formApi }) => {
      const baseMutable = {
        name: value.name,
        url: value.url,
        method: value.method,
        authKind: value.authKind,
        ...(value.authConfig ? { authConfig: value.authConfig } : { authConfig: null }),
        reachability: value.reachability,
      }
      const payload = variant === 'create' ? { ...baseMutable, slug: value.slug } : baseMutable
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
