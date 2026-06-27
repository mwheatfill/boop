import { useForm, useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ChannelIdentityFields,
  ChannelKindPicker,
  EmailChannelConfig,
  TeamsChannelConfig,
  WebhookChannelConfig,
} from '@/components/forms/ChannelModal.sections'
import { EntityModal } from '@/components/forms/EntityModal'
import type { FormApiFor } from '@/components/forms/form-api'
import { useSlugAutoFill } from '@/components/forms/use-slug-auto-fill'
import { createChannelFn, updateChannelFn } from '@/lib/channels/server-fns'
import { mailer } from '@/lib/email-recipe'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import {
  type Channel,
  ChannelConfigSchema,
  type ChannelKind,
  EMAIL_DEFAULT_BODY,
  EMAIL_DEFAULT_SUBJECT,
  WEBHOOK_DEFAULT_BODY,
} from '@/shared/schemas/channel'

export type ChannelModalOwner = { workspaceSlug: string }

export interface KindOption {
  kind: ChannelKind
  label: string
  description: string
}

const KIND_OPTIONS_BASE: KindOption[] = [
  { kind: 'teams', label: 'Microsoft Teams', description: 'Workflows-app webhook URL' },
  { kind: 'webhook', label: 'Generic Webhook', description: 'POST or PUT to any URL' },
  { kind: 'email', label: 'Email', description: 'Send via the email/send-pipeline recipe' },
]

const FALLBACK_KIND_OPTION: KindOption = {
  kind: 'teams',
  label: 'Microsoft Teams',
  description: 'Workflows-app webhook URL',
}

function availableKindOptions(): KindOption[] {
  if (mailer) return KIND_OPTIONS_BASE
  return KIND_OPTIONS_BASE.filter((o) => o.kind !== 'email')
}

export interface ChannelFormValues {
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

export type ChannelFormApi = FormApiFor<ChannelFormValues>

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
      recipients: values.emailRecipients.split(/[\s,;]+/).flatMap((s) => {
        const recipient = s.trim()
        return recipient ? [recipient] : []
      }),
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
        Object.entries(parsed as Record<string, unknown>).flatMap(([key, value]) =>
          typeof value === 'string' ? [[key, value]] : [],
        ),
      )
    }
  } catch {
    /* fall through */
  }
  return {}
}

interface ChannelModalProps {
  variant: 'create' | 'edit'
  owner: ChannelModalOwner
  initialChannel?: Channel
  onClose: () => void
  /** When provided, the modal calls this with the created Channel instead of navigating away. */
  onCreated?: (channel: Channel) => void | Promise<void>
}

export function ChannelModal({
  variant,
  owner,
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
        const result = await submitChannel({ variant, value, base, initialChannel, owner })

        if (!result.ok) {
          return {
            ...(result.message ? { form: result.message } : {}),
            fields: fieldErrorsToTanstack(result.fieldErrors),
          }
        }

        await queryClient.invalidateQueries({
          queryKey: ['workspaces', owner.workspaceSlug, 'channels'],
        })
        if (variant === 'create' && onCreated) {
          await onCreated(result.data)
          return null
        }
        toast.success(variant === 'create' ? `Channel ${result.data.name} created` : 'Saved')
        await navigate({ to: '/' })
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
  const selectedKindOption = kindOptions.find((o) => o.kind === kind) ?? FALLBACK_KIND_OPTION
  const channelForm = form as unknown as ChannelFormApi

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
        <ChannelIdentityFields form={channelForm} slug={slug} variant={variant} />
        <ChannelKindPicker
          variant={variant}
          form={channelForm}
          kindOptions={kindOptions}
          selectedKindOption={selectedKindOption}
        />
        {kind === 'teams' ? <TeamsChannelConfig form={channelForm} /> : null}
        {kind === 'email' && mailer ? <EmailChannelConfig form={channelForm} /> : null}
        {kind === 'webhook' ? (
          <WebhookChannelConfig form={channelForm} webhookMethod={webhookMethod} />
        ) : null}

        {formError ? <p className="text-sm text-destructive">{String(formError)}</p> : null}
      </form>
    </EntityModal>
  )
}

async function submitChannel({
  variant,
  value,
  base,
  initialChannel,
  owner,
}: {
  variant: 'create' | 'edit'
  value: ChannelFormValues
  base: { name: string; config: Channel['config'] }
  initialChannel: Channel | undefined
  owner: ChannelModalOwner
}): Promise<MutationResult<Channel>> {
  const workspaceSlug = owner.workspaceSlug
  return variant === 'create'
    ? createChannelFn({ data: { workspaceSlug, slug: value.slug, ...base } as never })
    : updateChannelFn({
        data: {
          workspaceSlug,
          channelSlug: initialChannel?.slug ?? '',
          ...base,
        } as never,
      })
}
