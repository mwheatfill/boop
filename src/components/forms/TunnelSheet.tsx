import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Loader2, Waypoints } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { toast } from 'sonner'
import { Section } from '@/components/Section'
import { TunnelInstallCommands } from '@/components/tunnels/TunnelInstallCommands'
import { TunnelStateBadge } from '@/components/tunnels/TunnelStateBadge'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAppForm } from '@/hooks/use-app-form'
import { slugify } from '@/lib/slug/slugify'
import { tunnelQueryOptions } from '@/lib/tunnels/query-options'
import { getTunnelInstallFn, provisionTunnelFn, updateTunnelFn } from '@/lib/tunnels/server-fns'
import { nameField } from '@/shared/schemas/fields'
import { type Tunnel, TunnelCreateInput } from '@/shared/schemas/tunnel'

// A freshly provisioned tunnel waiting for its connector to come online. boop
// resolves the owning Workspace server-side (default workspace), so no slug is
// threaded from the client; we derive the poll slug from the entered name.
interface Provisioned {
  hostname: string
  installToken: string
  slug: string
}

export interface TunnelSheetProps {
  tunnel?: Tunnel
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TunnelSheet({ tunnel, trigger, open: openProp, onOpenChange }: TunnelSheetProps) {
  const isEdit = !!tunnel
  const queryClient = useQueryClient()
  const [internalOpen, setInternalOpen] = useState(false)
  const [provisioned, setProvisioned] = useState<Provisioned | null>(null)
  const open = openProp ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  // After provisioning, poll the tunnel so the operator sees it flip to
  // Operational on its own once the connector connects (no manual refresh).
  const { data: live } = useQuery({
    ...tunnelQueryOptions(provisioned?.slug ?? ''),
    enabled: provisioned !== null,
    refetchInterval: (q) => (q.state.data?.state === 'operational' ? false : 4000),
  })

  // Editing an existing tunnel surfaces its connector install commands too, so the
  // Sheet is the one place for everything a tunnel needs (no separate dialog).
  const { data: installData } = useQuery({
    queryKey: ['tunnels', tunnel?.id, 'install'],
    queryFn: () => getTunnelInstallFn({ data: { tunnelId: tunnel?.id ?? '' } }),
    enabled: open && isEdit && !provisioned,
  })

  const form = useAppForm({
    defaultValues: { name: tunnel?.name ?? '' },
    validators: {
      onSubmitAsync: async ({ value }) => {
        const name = value.name.trim()
        if (isEdit) {
          const parsed = nameField.safeParse(name)
          if (!parsed.success) {
            return { fields: { name: parsed.error.issues[0]?.message ?? 'Name is required' } }
          }
          try {
            await updateTunnelFn({ data: { tunnelId: tunnel.id, name } })
          } catch (err) {
            return { form: err instanceof Error ? err.message : 'Save failed' }
          }
          await queryClient.invalidateQueries({ queryKey: ['tunnels'] })
          toast.success('Saved')
          setOpen(false)
          return null
        }
        const slug = slugify(name)
        const parsed = TunnelCreateInput.safeParse({ name, slug })
        if (!parsed.success) {
          const fieldErrors = parsed.error.flatten().fieldErrors
          const message = fieldErrors.name?.[0] ?? fieldErrors.slug?.[0] ?? 'Invalid name'
          return { fields: { name: message } }
        }
        try {
          const result = await provisionTunnelFn({ data: parsed.data })
          setProvisioned({ hostname: result.hostname, installToken: result.installToken, slug })
          await queryClient.invalidateQueries({ queryKey: ['tunnels'] })
          return null
        } catch (err) {
          return { form: err instanceof Error ? err.message : 'Provisioning failed' }
        }
      },
    },
  })

  function handleOpenChange(next: boolean) {
    if (next) {
      setProvisioned(null)
      form.reset()
    }
    setOpen(next)
  }

  const operational = live?.state === 'operational'

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
              <Waypoints className="size-5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <SheetTitle className="truncate text-base">
                {provisioned ? 'Install the connector' : isEdit ? tunnel.name : 'New tunnel'}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {provisioned
                  ? 'Run one of these on a host inside the private network.'
                  : isEdit
                    ? "Rename this tunnel. The address and hostname don't change."
                    : 'One connector per site. Install it once, then point Private Targets at this tunnel.'}
              </SheetDescription>
            </div>
            {isEdit && !provisioned ? <TunnelStateBadge state={tunnel.state} /> : null}
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
            {provisioned ? (
              <Section title="Connector">
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                  {operational ? (
                    <>
                      <CircleCheck className="size-4 text-success" aria-hidden />
                      <span className="text-foreground">Connected. The tunnel is operational.</span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
                      <span className="text-muted-foreground">
                        Waiting for the connector to come online…
                      </span>
                      {live ? <TunnelStateBadge state={live.state} /> : null}
                    </>
                  )}
                </div>
                <TunnelInstallCommands
                  hostname={provisioned.hostname}
                  installToken={provisioned.installToken}
                />
              </Section>
            ) : (
              <>
                <Section title="Identity">
                  <form.AppField name="name">
                    {(f) => (
                      <f.TextField
                        label="Name"
                        placeholder="Acme HQ"
                        autoFocus
                        description={
                          isEdit ? (
                            <>
                              Hostname{' '}
                              <code className="font-mono text-foreground">{tunnel.hostname}</code>{' '}
                              can't change.
                            </>
                          ) : (
                            'A site or network, not a single service. Internal addresses are set per Target.'
                          )
                        }
                      />
                    )}
                  </form.AppField>
                  <form.Subscribe selector={(s) => s.errorMap.onSubmit}>
                    {(formError) =>
                      formError ? <FieldError>{String(formError)}</FieldError> : null
                    }
                  </form.Subscribe>
                </Section>

                {isEdit ? (
                  <Section
                    title="Install the connector"
                    hint="Run one of these on a host inside the private network."
                  >
                    {installData ? (
                      <TunnelInstallCommands
                        hostname={installData.hostname}
                        installToken={installData.installToken}
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading install
                        command…
                      </div>
                    )}
                  </Section>
                ) : null}
              </>
            )}
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t p-4">
            {provisioned ? (
              <Button type="button" onClick={() => setOpen(false)}>
                {operational ? 'Done' : 'Close'}
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <form.AppForm>
                  <form.SubmitButton>{isEdit ? 'Save changes' : 'Create tunnel'}</form.SubmitButton>
                </form.AppForm>
              </>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
