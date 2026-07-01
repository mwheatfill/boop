import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Network, Target as TargetIcon } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Section } from '@/components/Section'
import { TargetHealthBadge } from '@/components/targets/TargetHealthBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { useAppForm } from '@/hooks/use-app-form'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import {
  archiveTargetFn,
  createTargetFn,
  restoreTargetFn,
  updateTargetFn,
} from '@/lib/targets/server-fns'
import { tunnelsQueryOptions } from '@/lib/tunnels/query-options'
import {
  type TARGET_AUTH_KINDS,
  TARGET_METHODS,
  type TARGET_REACHABILITIES,
  type Target,
} from '@/shared/schemas/target'
import { useSlugAutoFill } from './use-slug-auto-fill'

const METHOD_OPTIONS = TARGET_METHODS.map((m) => ({ value: m, label: m }))

const AUTH_OPTIONS: ReadonlyArray<{ value: (typeof TARGET_AUTH_KINDS)[number]; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer token' },
  { value: 'basic', label: 'Basic auth' },
  { value: 'header', label: 'Custom header' },
]

const REACHABILITY_OPTIONS: ReadonlyArray<{
  value: (typeof TARGET_REACHABILITIES)[number]
  label: string
}> = [
  { value: 'public', label: 'Public URL' },
  { value: 'tunnel', label: 'Private (via tunnel)' },
]

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
  originNoTlsVerify: boolean
}

function initialValues(target: Target | undefined): TargetFormValues {
  return {
    name: target?.name ?? '',
    slug: target?.slug ?? '',
    url: target?.url ?? '',
    method: target?.method ?? 'GET',
    authKind: target?.authKind ?? 'none',
    authConfig: target?.authConfig ?? '',
    reachability: target?.reachability ?? 'public',
    tunnelId: target?.tunnelId ?? '',
    internalOrigin: target?.internalOrigin ?? '',
    originNoTlsVerify: target?.originNoTlsVerify ?? false,
  }
}

function authConfigPlaceholder(authKind: TargetFormValues['authKind']): string {
  if (authKind === 'bearer') return 'Bearer token'
  if (authKind === 'basic') return 'user:password'
  return '{ "X-Api-Key": "..." }'
}

export interface TargetSheetProps {
  owner: { workspaceSlug: string }
  target?: Target
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Nested create: when set, the created Target is returned here instead of toasting. */
  onCreated?: (target: Target) => void | Promise<void>
}

export function TargetSheet({
  owner,
  target,
  trigger,
  open: openProp,
  onOpenChange,
  onCreated,
}: TargetSheetProps) {
  const isEdit = !!target
  const queryClient = useQueryClient()
  const slug = useSlugAutoFill(isEdit)
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const { data: tunnels = [], isLoading: tunnelsLoading } = useQuery(tunnelsQueryOptions)

  const form = useAppForm({
    defaultValues: initialValues(target),
    validators: {
      onSubmitAsync: async ({ value }) => {
        if (value.reachability === 'tunnel' && !value.tunnelId) {
          return { form: 'Select a tunnel.' }
        }
        if (value.reachability === 'tunnel' && !value.internalOrigin) {
          return { form: 'Enter the address on your network (e.g. http://10.0.1.50:8080).' }
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
                originNoTlsVerify: value.originNoTlsVerify,
              }
            : {
                reachability: 'public' as const,
                url: value.url,
                tunnelId: null,
                internalOrigin: null,
              }),
        }

        const result: MutationResult<Target> = isEdit
          ? await updateTargetFn({
              data: {
                workspaceSlug: owner.workspaceSlug,
                targetSlug: target.slug,
                ...base,
              } as never,
            })
          : await createTargetFn({
              data: { workspaceSlug: owner.workspaceSlug, slug: value.slug, ...base } as never,
            })

        if (!result.ok) {
          return {
            ...(result.message ? { form: result.message } : {}),
            fields: fieldErrorsToTanstack(result.fieldErrors),
          }
        }

        await queryClient.invalidateQueries({
          queryKey: ['workspaces', owner.workspaceSlug, 'targets'],
        })
        setOpen(false)
        if (!isEdit && onCreated) {
          await onCreated(result.data)
        } else {
          toast.success(isEdit ? 'Saved' : `Target ${result.data.name} created`)
        }
        return null
      },
    },
  })

  const invalidateTargets = () =>
    queryClient.invalidateQueries({ queryKey: ['workspaces', owner.workspaceSlug, 'targets'] })

  const archive = useMutation({
    mutationFn: () =>
      archiveTargetFn({
        data: { workspaceSlug: owner.workspaceSlug, targetSlug: target?.slug ?? '' },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? 'Could not delete the Target.')
        return
      }
      await invalidateTargets()
      toast.success('Target deleted', { description: 'Find it in the Recycle Bin.' })
      setOpen(false)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Delete failed'),
  })

  const restore = useMutation({
    mutationFn: () =>
      restoreTargetFn({
        data: { workspaceSlug: owner.workspaceSlug, targetSlug: target?.slug ?? '' },
      }),
    onSuccess: async () => {
      await invalidateTargets()
      toast.success('Target restored')
      setOpen(false)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Restore failed'),
  })

  function handleOpenChange(next: boolean) {
    if (next) {
      if (isEdit) slug.markManual()
      else slug.reset()
      form.reset(initialValues(target))
    }
    setOpen(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <SheetHeader className="flex-row items-center gap-3 space-y-0 border-b p-5 pr-14">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <TargetIcon className="size-5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <SheetTitle className="truncate text-base">
                {isEdit ? target.name : 'New Target'}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {isEdit ? 'Edit this web address' : 'A reusable web address for Jobs'}
              </SheetDescription>
            </div>
            {isEdit ? (
              target.status === 'archived' ? (
                <Badge variant="outline" className="shrink-0">
                  Deleted
                </Badge>
              ) : (
                <Badge variant="secondary" className="shrink-0">
                  {target.reachability === 'tunnel' ? 'Private' : 'Public'}
                </Badge>
              )
            ) : null}
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
            <Section icon={Network} title="Summary">
              <form.Subscribe
                selector={(s) => ({
                  method: s.values.method,
                  url: s.values.url,
                  reachability: s.values.reachability,
                  internalOrigin: s.values.internalOrigin,
                })}
              >
                {({ method, url, reachability, internalOrigin }) => {
                  const isTunnel = reachability === 'tunnel'
                  const address = (isTunnel ? internalOrigin : url) || 'Not set yet'
                  return (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{method}</Badge>
                        <Badge variant="outline">{isTunnel ? 'Private' : 'Public'}</Badge>
                        {isEdit && target.health ? (
                          <TargetHealthBadge health={target.health} />
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">Address</span>
                        <span className="break-all font-mono text-sm text-foreground">
                          {address}
                        </span>
                      </div>
                    </div>
                  )
                }}
              </form.Subscribe>
            </Section>

            <Section title="Identity">
              <form.AppField
                name="name"
                listeners={{
                  onChange: ({ value }) => {
                    if (!slug.isManual()) form.setFieldValue('slug', slugify(value))
                  },
                }}
              >
                {(f) => <f.TextField label="Name" placeholder="Primary API" autoFocus />}
              </form.AppField>
              <form.AppField name="slug">
                {(f) => (
                  <Field>
                    <FieldLabel htmlFor={f.name}>Slug</FieldLabel>
                    <input
                      id={f.name}
                      value={f.state.value}
                      readOnly={isEdit}
                      onChange={(e) => {
                        slug.markManual()
                        f.handleChange(e.currentTarget.value)
                      }}
                      onBlur={f.handleBlur}
                      placeholder="primary-api"
                      className="h-9 rounded-md border border-input bg-transparent px-3 font-mono text-xs shadow-xs read-only:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:bg-input/30"
                    />
                    <FieldDescription>
                      {isEdit ? "Slug can't change after creation." : 'Used in URLs and the API.'}
                    </FieldDescription>
                  </Field>
                )}
              </form.AppField>
            </Section>

            <Section title="Request">
              <form.AppField name="method">
                {(f) => <f.SelectField label="Method" options={METHOD_OPTIONS} />}
              </form.AppField>
              <form.AppField name="reachability">
                {(f) => (
                  <f.SelectField label="How boop reaches it" options={REACHABILITY_OPTIONS} />
                )}
              </form.AppField>
            </Section>

            <form.Subscribe selector={(s) => s.values.reachability}>
              {(reachability) =>
                reachability === 'tunnel' ? (
                  <Section title="Tunnel">
                    {!tunnelsLoading && tunnels.length === 0 ? (
                      <Field>
                        <FieldLabel>Tunnel</FieldLabel>
                        <FieldDescription>
                          No tunnels yet. Create one on the{' '}
                          <Link to="/tunnels" className="underline">
                            Tunnels page
                          </Link>
                          .
                        </FieldDescription>
                      </Field>
                    ) : (
                      <form.AppField name="tunnelId">
                        {(f) => (
                          <f.SelectField
                            label="Tunnel"
                            placeholder="Select a tunnel"
                            options={tunnels.map((t) => ({ value: t.id, label: t.name }))}
                          />
                        )}
                      </form.AppField>
                    )}
                    <form.AppField name="internalOrigin">
                      {(f) => (
                        <f.TextField
                          label="Address"
                          placeholder="http://10.0.1.50:8080"
                          description="Where the service runs on your network."
                        />
                      )}
                    </form.AppField>
                    {isEdit && target.reachability === 'tunnel' ? (
                      <Field>
                        <FieldLabel>Public URL</FieldLabel>
                        <code className="break-all font-mono text-xs text-foreground">
                          {target.url}
                        </code>
                        <FieldDescription>
                          boop calls this; the tunnel forwards it to the address above.
                        </FieldDescription>
                      </Field>
                    ) : null}
                    <form.Subscribe selector={(s) => s.values.internalOrigin}>
                      {(internalOrigin) =>
                        internalOrigin.trim().toLowerCase().startsWith('https://') ? (
                          <form.AppField name="originNoTlsVerify">
                            {(f) => (
                              <f.SwitchField
                                label="Allow self-signed certificate"
                                description="Turn on if the server uses its own certificate."
                              />
                            )}
                          </form.AppField>
                        ) : null
                      }
                    </form.Subscribe>
                  </Section>
                ) : (
                  <Section title="Address">
                    <form.AppField name="url">
                      {(f) => (
                        <f.TextField
                          label="URL"
                          type="url"
                          placeholder="https://api.example.com/healthz"
                        />
                      )}
                    </form.AppField>
                  </Section>
                )
              }
            </form.Subscribe>

            <Section title="Authentication">
              <form.AppField name="authKind">
                {(f) => <f.SelectField label="Auth" options={AUTH_OPTIONS} />}
              </form.AppField>
              <form.Subscribe selector={(s) => s.values.authKind}>
                {(authKind) =>
                  authKind !== 'none' ? (
                    <form.AppField name="authConfig">
                      {(f) => (
                        <f.TextareaField
                          label="Auth config"
                          rows={3}
                          placeholder={authConfigPlaceholder(authKind)}
                        />
                      )}
                    </form.AppField>
                  ) : null
                }
              </form.Subscribe>
            </Section>

            <form.Subscribe selector={(s) => s.errorMap.onSubmit}>
              {(formError) => (formError ? <FieldError>{String(formError)}</FieldError> : null)}
            </form.Subscribe>
          </div>

          <SheetFooter
            className={`flex-row items-center gap-2 border-t p-4 ${
              isEdit ? 'justify-between' : 'justify-end'
            }`}
          >
            {isEdit ? (
              target.status === 'archived' ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate()}
                >
                  {restore.isPending ? (
                    <>
                      <Spinner /> Restoring
                    </>
                  ) : (
                    'Restore'
                  )}
                </Button>
              ) : (
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="ghost" className="text-destructive">
                      Delete
                    </Button>
                  }
                  title={`Delete ${target.name}?`}
                  description="This also deletes any Jobs that call this Target. Everything moves to the Recycle Bin, where you can restore it later."
                  confirmLabel="Delete Target"
                  onConfirm={() => archive.mutate()}
                />
              )
            ) : null}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <form.AppForm>
                <form.SubmitButton>{isEdit ? 'Save changes' : 'Create Target'}</form.SubmitButton>
              </form.AppForm>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
