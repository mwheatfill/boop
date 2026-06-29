import { useQueryClient } from '@tanstack/react-query'
import { SendHorizonal } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { toast } from 'sonner'
import { Section } from '@/components/Section'
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
import { useAppForm } from '@/hooks/use-app-form'
import { createChannelFn, updateChannelFn } from '@/lib/channels/server-fns'
import { EMAIL_RECIPE_INSTALLED } from '@/lib/email-recipe'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import {
  type Channel,
  ChannelConfigSchema,
  type ChannelKind,
  EMAIL_DEFAULT_BODY,
  EMAIL_DEFAULT_SUBJECT,
  WEBHOOK_DEFAULT_BODY,
} from '@/shared/schemas/channel'
import { useSlugAutoFill } from './use-slug-auto-fill'

const KIND_OPTIONS: ReadonlyArray<{ value: ChannelKind; label: string }> = [
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'webhook', label: 'Generic webhook' },
  { value: 'email', label: 'Email' },
]

function kindOptions() {
  return EMAIL_RECIPE_INSTALLED ? KIND_OPTIONS : KIND_OPTIONS.filter((o) => o.value !== 'email')
}

interface ChannelFormValues {
  name: string
  slug: string
  kind: ChannelKind
  teamsWebhookUrl: string
  emailRecipients: string
  emailSubject: string
  emailBody: string
  webhookUrl: string
  webhookMethod: 'POST' | 'PUT'
  webhookHeaders: string
  webhookBody: string
}

function initialValues(channel: Channel | undefined): ChannelFormValues {
  const config = channel?.config
  return {
    name: channel?.name ?? '',
    slug: channel?.slug ?? '',
    kind: channel?.kind ?? 'teams',
    teamsWebhookUrl: config?.kind === 'teams' ? config.webhook_url : '',
    emailRecipients: config?.kind === 'email' ? config.recipients.join(', ') : '',
    emailSubject: config?.kind === 'email' ? config.subject_template : EMAIL_DEFAULT_SUBJECT,
    emailBody: config?.kind === 'email' ? config.body_template : EMAIL_DEFAULT_BODY,
    webhookUrl: config?.kind === 'webhook' ? config.url : '',
    webhookMethod: config?.kind === 'webhook' ? config.method : 'POST',
    webhookHeaders: config?.kind === 'webhook' ? JSON.stringify(config.headers, null, 2) : '{}',
    webhookBody: config?.kind === 'webhook' ? config.body_template : WEBHOOK_DEFAULT_BODY,
  }
}

function parseHeaders(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).flatMap(([key, value]) =>
          typeof value === 'string' ? [[key, value]] : [],
        ),
      )
    }
  } catch {
    /* fall through to empty */
  }
  return {}
}

function buildConfig(v: ChannelFormValues) {
  if (v.kind === 'teams') return { kind: 'teams' as const, webhook_url: v.teamsWebhookUrl }
  if (v.kind === 'email') {
    return {
      kind: 'email' as const,
      recipients: v.emailRecipients.split(/[\s,;]+/).flatMap((s) => (s.trim() ? [s.trim()] : [])),
      subject_template: v.emailSubject,
      body_template: v.emailBody,
    }
  }
  return {
    kind: 'webhook' as const,
    url: v.webhookUrl,
    method: v.webhookMethod,
    headers: parseHeaders(v.webhookHeaders),
    body_template: v.webhookBody,
  }
}

export interface ChannelSheetProps {
  owner: { workspaceSlug: string }
  channel?: Channel
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Nested create: when set, the created Channel is returned here instead of toasting. */
  onCreated?: (channel: Channel) => void | Promise<void>
}

export function ChannelSheet({
  owner,
  channel,
  trigger,
  open: openProp,
  onOpenChange,
  onCreated,
}: ChannelSheetProps) {
  const isEdit = !!channel
  const queryClient = useQueryClient()
  const slug = useSlugAutoFill(isEdit)
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const form = useAppForm({
    defaultValues: initialValues(channel),
    validators: {
      onSubmitAsync: async ({ value }) => {
        const parsed = ChannelConfigSchema.safeParse(buildConfig(value))
        if (!parsed.success) {
          return { fields: { config: parsed.error.flatten().fieldErrors as never as string } }
        }
        const base = { name: value.name, config: parsed.data }
        const result: MutationResult<Channel> = isEdit
          ? await updateChannelFn({
              data: { workspaceSlug: owner.workspaceSlug, channelSlug: channel.slug, ...base },
            } as never)
          : await createChannelFn({
              data: { workspaceSlug: owner.workspaceSlug, slug: value.slug, ...base },
            } as never)
        if (!result.ok) {
          return {
            ...(result.message ? { form: result.message } : {}),
            fields: fieldErrorsToTanstack(result.fieldErrors),
          }
        }
        await queryClient.invalidateQueries({
          queryKey: ['workspaces', owner.workspaceSlug, 'channels'],
        })
        setOpen(false)
        if (!isEdit && onCreated) {
          await onCreated(result.data)
        } else {
          toast.success(isEdit ? 'Saved' : `Channel ${result.data.name} created`)
        }
        return null
      },
    },
  })

  function handleOpenChange(next: boolean) {
    if (next) {
      if (isEdit) slug.markManual()
      else slug.reset()
      form.reset()
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
              <SendHorizonal className="size-5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <SheetTitle className="truncate text-base">
                {isEdit ? channel.name : 'New Channel'}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {isEdit ? 'Edit this outbound destination' : 'An outbound destination for alerts'}
              </SheetDescription>
            </div>
            {isEdit ? (
              <Badge variant="secondary" className="shrink-0">
                {channel.kind}
              </Badge>
            ) : null}
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
            <Section title="Identity">
              <form.AppField
                name="name"
                listeners={{
                  onChange: ({ value }) => {
                    if (!slug.isManual()) form.setFieldValue('slug', slugify(value))
                  },
                }}
              >
                {(f) => <f.TextField label="Name" placeholder="Ops Teams channel" autoFocus />}
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
                      placeholder="ops-teams"
                      className="h-9 rounded-md border border-input bg-transparent px-3 font-mono text-xs shadow-xs read-only:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:bg-input/30"
                    />
                    <FieldDescription>
                      {isEdit ? "Slug can't change after creation." : 'Used in URLs and the API.'}
                    </FieldDescription>
                  </Field>
                )}
              </form.AppField>
            </Section>

            <Section title="Type">
              <form.AppField name="kind">
                {(f) =>
                  isEdit ? (
                    <Field>
                      <FieldLabel>Kind</FieldLabel>
                      <p className="text-sm">{channel.kind}</p>
                      <FieldDescription>Kind can't change after creation.</FieldDescription>
                    </Field>
                  ) : (
                    <f.SelectField label="Kind" options={kindOptions()} />
                  )
                }
              </form.AppField>
            </Section>

            <form.Subscribe selector={(s) => s.values.kind}>
              {(kind) => (
                <Section title="Delivery">
                  {kind === 'teams' ? (
                    <form.AppField name="teamsWebhookUrl">
                      {(f) => (
                        <f.TextField
                          label="Webhook URL"
                          type="url"
                          placeholder="https://prod-XX.logic.azure.com/workflows/..."
                          description="From a Teams Workflow's incoming-webhook trigger. Legacy O365 connector URLs still work."
                        />
                      )}
                    </form.AppField>
                  ) : null}
                  {kind === 'email' && EMAIL_RECIPE_INSTALLED ? (
                    <>
                      <form.AppField name="emailRecipients">
                        {(f) => (
                          <f.TextareaField
                            label="Recipients"
                            rows={2}
                            description="Comma or newline separated."
                          />
                        )}
                      </form.AppField>
                      <form.AppField name="emailSubject">
                        {(f) => <f.TextField label="Subject template" />}
                      </form.AppField>
                      <form.AppField name="emailBody">
                        {(f) => <f.TextareaField label="Body template" rows={8} />}
                      </form.AppField>
                    </>
                  ) : null}
                  {kind === 'webhook' ? (
                    <>
                      <form.AppField name="webhookUrl">
                        {(f) => <f.TextField label="URL" type="url" />}
                      </form.AppField>
                      <form.AppField name="webhookMethod">
                        {(f) => (
                          <f.SelectField
                            label="Method"
                            options={[
                              { value: 'POST', label: 'POST' },
                              { value: 'PUT', label: 'PUT' },
                            ]}
                          />
                        )}
                      </form.AppField>
                      <form.AppField name="webhookHeaders">
                        {(f) => (
                          <f.TextareaField
                            label="Headers (JSON)"
                            rows={3}
                            description="JSON object."
                          />
                        )}
                      </form.AppField>
                      <form.AppField name="webhookBody">
                        {(f) => <f.TextareaField label="Body template" rows={6} />}
                      </form.AppField>
                    </>
                  ) : null}
                </Section>
              )}
            </form.Subscribe>

            <form.Subscribe selector={(s) => s.errorMap.onSubmit}>
              {(formError) => (formError ? <FieldError>{String(formError)}</FieldError> : null)}
            </form.Subscribe>
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t p-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <form.AppForm>
              <form.SubmitButton>{isEdit ? 'Save changes' : 'Create Channel'}</form.SubmitButton>
            </form.AppForm>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
