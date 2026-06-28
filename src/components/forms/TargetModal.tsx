import { useForm, useStore } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { EntityModal } from '@/components/forms/EntityModal'
import { PillButton } from '@/components/forms/PillPicker'
import { useSlugAutoFill } from '@/components/forms/use-slug-auto-fill'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import { createTargetFn, updateTargetFn } from '@/lib/targets/server-fns'
import { tunnelsQueryOptions } from '@/lib/tunnels/query-options'
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
  tunnelId: string
  internalOrigin: string
  originHostHeader: string
  originServerName: string
  originNoTlsVerify: boolean
}

interface CreateProps {
  variant: 'create'
  workspaceSlug: string
  onClose: () => void
  /** Called instead of navigating when used as a nested dialog inside JobModal. */
  onCreated?: (target: Target) => void | Promise<void>
}

interface EditProps {
  variant: 'edit'
  workspaceSlug: string
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
          tunnelId: props.initialTarget.tunnelId ?? '',
          internalOrigin: props.initialTarget.internalOrigin ?? '',
          originHostHeader: props.initialTarget.originHostHeader ?? '',
          originServerName: props.initialTarget.originServerName ?? '',
          originNoTlsVerify: props.initialTarget.originNoTlsVerify,
        }
      : {
          name: '',
          slug: '',
          url: '',
          method: 'GET',
          authKind: 'none',
          authConfig: '',
          reachability: 'public',
          tunnelId: '',
          internalOrigin: '',
          originHostHeader: '',
          originServerName: '',
          originNoTlsVerify: false,
        }

  const form = useForm({
    defaultValues: initial,
    validators: {
      onSubmitAsync: async ({ value }) => {
        if (value.reachability === 'tunnel' && !value.tunnelId) {
          return { form: 'Select a tunnel.' }
        }
        if (value.reachability === 'tunnel' && !value.internalOrigin) {
          return { form: 'Enter the internal origin (e.g. http://10.0.1.50:8080).' }
        }
        const base = {
          name: value.name,
          method: value.method,
          authKind: value.authKind,
          ...(value.authConfig ? { authConfig: value.authConfig } : { authConfig: null }),
          ...(value.reachability === 'tunnel'
            ? {
                reachability: 'tunnel' as const,
                tunnelId: value.tunnelId,
                internalOrigin: value.internalOrigin,
                originHostHeader: value.originHostHeader || null,
                originServerName: value.originServerName || null,
                originNoTlsVerify: value.originNoTlsVerify,
              }
            : {
                reachability: 'public' as const,
                url: value.url,
                tunnelId: null,
                internalOrigin: null,
              }),
        }

        const result: MutationResult<Target> =
          props.variant === 'create'
            ? await createTargetFn({
                data: { workspaceSlug: props.workspaceSlug, ...base, slug: value.slug } as never,
              })
            : await updateTargetFn({
                data: {
                  workspaceSlug: props.workspaceSlug,
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
          queryKey: ['workspaces', props.workspaceSlug, 'targets'],
        })

        if (props.variant === 'create' && props.onCreated) {
          await props.onCreated(result.data)
          return null
        }

        toast.success(props.variant === 'create' ? `Target ${result.data.name} created` : 'Saved')
        await navigate({ to: '/' })
        return null
      },
    },
  })

  const isDirty = useStore(form.store, (s) => s.isDirty)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)
  const method = useStore(form.store, (s) => s.values.method)
  const authKind = useStore(form.store, (s) => s.values.authKind)
  const reachability = useStore(form.store, (s) => s.values.reachability)
  const tunnelId = useStore(form.store, (s) => s.values.tunnelId)
  const formError = useStore(form.store, (s) => s.errorMap.onSubmit)
  const { data: tunnels = [], isLoading: tunnelsLoading } = useQuery(tunnelsQueryOptions)

  const [methodOpen, setMethodOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [reachOpen, setReachOpen] = useState(false)
  const [tunnelOpen, setTunnelOpen] = useState(false)

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

        {reachability !== 'tunnel' ? (
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
        ) : null}

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

        {reachability === 'tunnel' ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Tunnel</span>
            {!tunnelsLoading && tunnels.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tunnels yet. Create one on the{' '}
                <Link to="/tunnels/new" className="underline">
                  Tunnels page
                </Link>
                .
              </p>
            ) : (
              <Popover open={tunnelOpen} onOpenChange={setTunnelOpen}>
                <PopoverTrigger
                  render={
                    <PillButton
                      label="Tunnel"
                      value={tunnels.find((t) => t.id === tunnelId)?.name}
                    />
                  }
                />
                <PopoverContent className="w-56 p-1">
                  <ul className="flex flex-col gap-px">
                    {tunnels.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          className="flex w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            form.setFieldValue('tunnelId', t.id)
                            setTunnelOpen(false)
                          }}
                        >
                          {t.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            )}
            <form.Field name="internalOrigin">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                    Internal origin
                  </label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    placeholder="http://10.0.1.50:8080"
                    className="font-mono text-sm"
                    onChange={(e) => field.handleChange(e.currentTarget.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    The on-prem address the connector forwards to (IIS host:port). boop builds the
                    public URL from the tunnel.
                  </p>
                </div>
              )}
            </form.Field>

            <form.Field name="originHostHeader">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                    Host header (optional)
                  </label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    placeholder="api.internal.corp"
                    className="font-mono text-sm"
                    onChange={(e) => field.handleChange(e.currentTarget.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sent as the <code className="font-mono">Host</code> header to the origin. Set
                    this to the IIS site's hostname if it uses host-header bindings; leave blank to
                    forward as-is.
                  </p>
                </div>
              )}
            </form.Field>

            <form.Field name="originServerName">
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                    TLS server name (optional)
                  </label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    placeholder="api.internal.corp"
                    className="font-mono text-sm"
                    onChange={(e) => field.handleChange(e.currentTarget.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    For an HTTPS origin, the hostname on its certificate. Only needed when the
                    internal origin is <code className="font-mono">https://</code> with a cert that
                    doesn't match the address.
                  </p>
                </div>
              )}
            </form.Field>

            <form.Field name="originNoTlsVerify">
              {(field) => (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">Skip TLS verification</span>
                    <span className="text-xs text-muted-foreground">
                      Accept the origin's certificate without verifying it. Last resort for internal
                      self-signed HTTPS origins.
                    </span>
                  </div>
                  <Switch
                    checked={field.state.value}
                    onCheckedChange={(v) => field.handleChange(v)}
                    aria-label="Skip TLS verification"
                  />
                </div>
              )}
            </form.Field>
          </div>
        ) : null}

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
