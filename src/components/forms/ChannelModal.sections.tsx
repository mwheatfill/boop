import type { ChannelFormApi, KindOption } from '@/components/forms/ChannelModal'
import { SingleSelectPill } from '@/components/forms/SingleSelectPill'
import type { useSlugAutoFill } from '@/components/forms/use-slug-auto-fill'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { slugify } from '@/lib/slug/slugify'

export function ChannelIdentityFields({
  form,
  slug,
  variant,
}: {
  form: ChannelFormApi
  slug: ReturnType<typeof useSlugAutoFill>
  variant: 'create' | 'edit'
}) {
  return (
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
            placeholder="Name this Channel..."
            onChange={(e) => field.handleChange(e.currentTarget.value)}
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
            <p className="text-xs text-muted-foreground/70">Slug can't change after creation.</p>
          ) : null}
        </div>
      )}
    </form.Field>
  )
}

export function ChannelKindPicker({
  variant,
  form,
  kindOptions,
  selectedKindOption,
}: {
  variant: 'create' | 'edit'
  form: ChannelFormApi
  kindOptions: KindOption[]
  selectedKindOption: KindOption
}) {
  return (
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
  )
}

export function TeamsChannelConfig({ form }: { form: ChannelFormApi }) {
  return (
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
            placeholder="https://prod-XX.westus.logic.azure.com:443/workflows/..."
            onChange={(e) => field.handleChange(e.currentTarget.value)}
          />
          <p className="text-xs text-muted-foreground/70">
            Paste a URL from a Teams Workflow's "When a Teams webhook request is received" trigger.
            Legacy O365 Connector URLs still work during Microsoft's deprecation window.
          </p>
        </div>
      )}
    </form.Field>
  )
}

export function EmailChannelConfig({ form }: { form: ChannelFormApi }) {
  return (
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
  )
}

export function WebhookChannelConfig({
  form,
  webhookMethod,
}: {
  form: ChannelFormApi
  webhookMethod: 'POST' | 'PUT'
}) {
  return (
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
  )
}
