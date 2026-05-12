import { useForm, useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { EntityModal } from '@/components/forms/EntityModal'
import { SingleSelectPill } from '@/components/forms/SingleSelectPill'
import { useSlugAutoFill } from '@/components/forms/use-slug-auto-fill'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createChannelFn, updateChannelFn } from '@/lib/channels/server-fns'
import { mailer } from '@/lib/email-recipe'
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

interface KindOption {
  kind: ChannelKind
  label: string
  description: string
}

const KIND_OPTIONS_BASE: KindOption[] = [
  { kind: 'teams', label: 'Microsoft Teams', description: 'Workflows-app webhook URL' },
  { kind: 'webhook', label: 'Generic Webhook', description: 'POST or PUT to any URL' },
  { kind: 'email', label: 'Email', description: 'Send via the email/send-pipeline recipe' },
]

function availableKindOptions(): KindOption[] {
  if (mailer) return KIND_OPTIONS_BASE
  return KIND_OPTIONS_BASE.filter((o) => o.kind !== 'email')
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
  if (!channel) {
    return {
      name: '',
      slug: '',
      kind: 'teams',
      teamsWebhookUrl: '',
      emailRecipients: '',
      emailSubject: EMAIL_DEFAULT_SUBJECT,
      emailBody: EMAIL_DEFAULT_BODY,
      webhookUrl: '',
      webhookMethod: 'POST',
      webhookHeaders: '{}',
      webhookBody: WEBHOOK_DEFAULT_BODY,
    }
  }
  const config = channel.config
  return {
    name: channel.name,
    slug: channel.slug,
    kind: channel.kind,
    teamsWebhookUrl: config.kind === 'teams' ? config.webhook_url : '',
    emailRecipients: config.kind === 'email' ? config.recipients.join(', ') : '',
    emailSubject: config.kind === 'email' ? config.subject_template : EMAIL_DEFAULT_SUBJECT,
    emailBody: config.kind === 'email' ? config.body_template : EMAIL_DEFAULT_BODY,
    webhookUrl: config.kind === 'webhook' ? config.url : '',
    webhookMethod: config.kind === 'webhook' ? config.method : 'POST',
    webhookHeaders: config.kind === 'webhook' ? JSON.stringify(config.headers, null, 2) : '{}',
    webhookBody: config.kind === 'webhook' ? config.body_template : WEBHOOK_DEFAULT_BODY,
  }
}

function buildConfig(values: ChannelFormValues) {
  if (values.kind === 'teams') {
    return { kind: 'teams' as const, webhook_url: values.teamsWebhookUrl }
  }
  if (values.kind === 'email') {
    return {
      kind: 'email' as const,
      recipients: values.emailRecipients
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      subject_template: values.emailSubject,
      body_template: values.emailBody,
    }
  }
  return {
    kind: 'webhook' as const,
    url: values.webhookUrl,
    method: values.webhookMethod,
    headers: parseHeaders(values.webhookHeaders),
    body_template: values.webhookBody,
  }
}

function parseHeaders(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>)
          .filter(([, v]) => typeof v === 'string')
          .map(([k, v]) => [k, v as string]),
      )
    }
  } catch {
    /* fall through */
  }
  return {}
}

interface ChannelModalProps {
  variant: 'create' | 'edit'
  customerSlug: string
  initialChannel?: Channel
  onClose: () => void
  /** When provided, the modal calls this with the created Channel instead of navigating away. */
  onCreated?: (channel: Channel) => void | Promise<void>
}

export function ChannelModal({
  variant,
  customerSlug,
  initialChannel,
  onClose,
  onCreated,
}: ChannelModalProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const slug = useSlugAutoFill(variant === 'edit')

  const form = useForm({
    defaultValues: initialValues(initialChannel),
    validators: {
      onSubmitAsync: async ({ value }) => {
        const config = buildConfig(value)
        const parsed = ChannelConfigSchema.safeParse(config)
        if (!parsed.success) {
          const flat = parsed.error.flatten()
          return { fields: { config: flat.fieldErrors as never as string } }
        }
        const base = { name: value.name, config: parsed.data }
        const result: MutationResult<Channel> =
          variant === 'create'
            ? await createChannelFn({
                data: { customerSlug, slug: value.slug, ...base } as never,
              })
            : await updateChannelFn({
                data: {
                  customerSlug,
                  channelSlug: initialChannel?.slug ?? '',
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
          queryKey: ['customers', customerSlug, 'channels'],
        })
        if (variant === 'create' && onCreated) {
          await onCreated(result.data)
          return null
        }
        toast.success(variant === 'create' ? `Channel ${result.data.name} created` : 'Saved')
        await navigate({ to: '/customers/$customerSlug', params: { customerSlug } })
        return null
      },
    },
  })

  const isDirty = useStore(form.store, (s) => s.isDirty)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)
  const kind = useStore(form.store, (s) => s.values.kind)
  const webhookMethod = useStore(form.store, (s) => s.values.webhookMethod)
  const formError = useStore(form.store, (s) => s.errorMap.onSubmit)
  const kindOptions = availableKindOptions()
  const selectedKindOption = kindOptions.find((o) => o.kind === kind) ?? kindOptions[0]

  return (
    <EntityModal
      open
      onClose={onClose}
      title={variant === 'create' ? 'New Channel' : `Edit ${initialChannel?.name ?? 'Channel'}`}
      dirty={isDirty && !isSubmitting}
      primaryAction={{
        label: variant === 'create' ? 'Create Channel' : 'Save changes',
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
                placeholder="Name this Channel…"
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                autoFocus
                className="h-auto border-0 bg-transparent px-0 text-xl font-medium tracking-tight shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
              />
              <form.Field name="slug">
                {(slugField) => (
                  <input
                    type="text"
                    value={slugField.state.value}
                    readOnly={variant === 'edit'}
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
              {variant === 'edit' ? (
                <p className="text-xs text-muted-foreground/70">
                  Slug can't change after creation.
                </p>
              ) : null}
            </div>
          )}
        </form.Field>

        <div className="flex flex-wrap items-center gap-2">
          <SingleSelectPill
            label="Kind"
            required
            disabled={variant === 'edit'}
            items={kindOptions}
            selected={selectedKindOption}
            getKey={(o) => o.kind}
            getPrimary={(o) => o.label}
            getSecondary={(o) => o.description}
            onSelect={(o) => form.setFieldValue('kind', o.kind)}
          />
        </div>

        {kind === 'teams' ? (
          <form.Field name="teamsWebhookUrl">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                  Webhook URL
                </label>
                <Input
                  id={field.name}
                  type="url"
                  value={field.state.value}
                  placeholder="https://prod-XX.westus.logic.azure.com:443/workflows/…"
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                />
                <p className="text-xs text-muted-foreground/70">
                  Paste a URL from a Teams Workflow's "When a Teams webhook request is received"
                  trigger. Legacy O365 Connector URLs still work during Microsoft's deprecation
                  window.
                </p>
              </div>
            )}
          </form.Field>
        ) : null}

        {kind === 'email' && mailer ? (
          <div className="flex flex-col gap-3">
            <form.Field name="emailRecipients">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                    Recipients (comma or newline separated)
                  </label>
                  <Textarea
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.currentTarget.value)}
                    rows={2}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="emailSubject">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                    Subject template (LiquidJS)
                  </label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.currentTarget.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="emailBody">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                    Body template (LiquidJS)
                  </label>
                  <Textarea
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.currentTarget.value)}
                    rows={8}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </form.Field>
          </div>
        ) : null}

        {kind === 'webhook' ? (
          <div className="flex flex-col gap-3">
            <form.Field name="webhookUrl">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                    URL
                  </label>
                  <Input
                    id={field.name}
                    type="url"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.currentTarget.value)}
                  />
                </div>
              )}
            </form.Field>
            <div className="flex flex-wrap items-center gap-2">
              <SingleSelectPill
                label="Method"
                items={[{ value: 'POST' as const }, { value: 'PUT' as const }]}
                selected={{ value: webhookMethod }}
                getKey={(o) => o.value}
                getPrimary={(o) => o.value}
                onSelect={(o) => form.setFieldValue('webhookMethod', o.value)}
              />
            </div>
            <form.Field name="webhookHeaders">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                    Headers (JSON object)
                  </label>
                  <Textarea
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.currentTarget.value)}
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="webhookBody">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                    Body template (LiquidJS)
                  </label>
                  <Textarea
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.currentTarget.value)}
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </form.Field>
          </div>
        ) : null}

        {formError ? <p className="text-sm text-destructive">{String(formError)}</p> : null}
      </form>
    </EntityModal>
  )
}
