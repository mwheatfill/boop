import { Plus } from 'lucide-react'
import type {
  CustomerOption,
  JobFormApi,
  JobModalUiAction,
  TemplateApplyOptions,
} from '@/components/forms/JobModal'
import {
  KeyValueListEditor,
  type KeyValueRow,
  rowsToVariableMap,
} from '@/components/forms/KeyValueListEditor'
import { PillButton } from '@/components/forms/PillPicker'
import { type CreateAffordance, SearchableCombobox } from '@/components/forms/SearchableCombobox'
import { TemplateEditor } from '@/components/forms/TemplateEditor'
import { TriggerPicker } from '@/components/forms/TriggerPicker'
import type { useSlugAutoFill } from '@/components/forms/use-slug-auto-fill'
import { TemplateGallery } from '@/components/templates/TemplateGallery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { triggerSummaryWithTimezone } from '@/lib/jobs/format'
import { slugify } from '@/lib/slug/slugify'
import type { Job, TriggerKind } from '@/shared/schemas/job'
import type { JobTemplate } from '@/shared/schemas/job-template'
import type { Target } from '@/shared/schemas/target'

const BODY_HELP_TEXT =
  'LiquidJS. Available: {{ run_id }}, {{ attempt_number }}, {{ customer_name }}, {{ customer_timezone }}, {{ now }}, plus operator-defined variables. {% boop_secret "name" %} pulls a Customer secret at fire time.'

function buildVariableRows(
  customerVars: Record<string, string>,
  jobVars: Record<string, string>,
): KeyValueRow[] {
  const fromCustomer = Object.keys(customerVars)
    .sort()
    .map<KeyValueRow>((name) => {
      const customerValue = customerVars[name] ?? ''
      if (Object.hasOwn(jobVars, name)) {
        return {
          name,
          value: jobVars[name] ?? '',
          source: 'override',
          inherited: { from: 'customer', value: customerValue },
        }
      }
      return { name, value: customerValue, source: 'customer' }
    })
  const jobOnly = Object.keys(jobVars)
    .filter((k) => !Object.hasOwn(customerVars, k))
    .sort()
    .map<KeyValueRow>((name) => ({ name, value: jobVars[name] ?? '', source: 'job' }))
  return [...fromCustomer, ...jobOnly]
}

function buildAutocompleteVariables(
  customerVars: Record<string, string>,
  jobVars: Record<string, string>,
): Array<{ name: string; value: string; source: 'customer' | 'job' }> {
  return Object.entries({ ...customerVars, ...jobVars }).map(([name, value]) => ({
    name,
    value,
    source: Object.hasOwn(jobVars, name) ? 'job' : 'customer',
  }))
}

export function JobIdentityFields({
  form,
  slug,
  variant,
}: {
  form: JobFormApi
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
            placeholder="Name this Job..."
            onChange={(e) => field.handleChange(e.currentTarget.value)}
            aria-invalid={field.state.meta.errors[0] ? 'true' : undefined}
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
          {field.state.meta.errors[0] ? (
            <p className="text-xs text-destructive">{String(field.state.meta.errors[0])}</p>
          ) : null}
          {variant === 'edit' ? (
            <p className="text-xs text-muted-foreground/70">Slug can't change after creation.</p>
          ) : null}
        </div>
      )}
    </form.Field>
  )
}

export function JobTemplateChooser({
  variant,
  view,
  templates,
  customerSlug,
  selectedCustomer,
  dispatchUi,
  applyTemplate,
}: {
  variant: 'create' | 'edit'
  view: 'form' | 'templates'
  templates: JobTemplate[]
  customerSlug: string
  selectedCustomer: CustomerOption | null
  dispatchUi: (action: JobModalUiAction) => void
  applyTemplate: (options: TemplateApplyOptions) => void
}) {
  if (variant !== 'create') return null
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={view === 'form' ? 'default' : 'outline'}
          onClick={() => dispatchUi({ type: 'view-changed', view: 'form' })}
        >
          Start from scratch
        </Button>
        <Button
          type="button"
          size="sm"
          variant={view === 'templates' ? 'default' : 'outline'}
          onClick={() => dispatchUi({ type: 'view-changed', view: 'templates' })}
        >
          Use a template
        </Button>
      </div>
      {view === 'templates' ? (
        <TemplateGallery
          compact
          templates={templates}
          onSelect={(template) => {
            const templateCustomerSlug = customerSlug || selectedCustomer?.slug
            if (!templateCustomerSlug) return
            applyTemplate({
              template,
              customerSlug: templateCustomerSlug,
              fallbackTimezone: selectedCustomer?.timezone ?? 'UTC',
            })
          }}
        />
      ) : null}
    </>
  )
}

export function JobFormSections({
  form,
  variant,
  initialJob,
  isAdmin,
  customers,
  customerRecents,
  customerSlug,
  selectedCustomer,
  customerCreateAffordance,
  targets,
  targetRecents,
  selectedTarget,
  targetCreateAffordance,
  targetPlaceholder,
  triggerKind,
  cronExpression,
  intervalSeconds,
  triggerTimezone,
  secretNames,
  dispatchUi,
}: {
  form: JobFormApi
  variant: 'create' | 'edit'
  initialJob: Job | undefined
  isAdmin: boolean
  customers: CustomerOption[]
  customerRecents: CustomerOption[]
  customerSlug: string
  selectedCustomer: CustomerOption | null
  customerCreateAffordance: CreateAffordance
  targets: Target[]
  targetRecents: Target[]
  selectedTarget: Target | null
  targetCreateAffordance: CreateAffordance
  targetPlaceholder: string | null
  triggerKind: TriggerKind
  cronExpression: string
  intervalSeconds: number
  triggerTimezone: string
  secretNames: Array<{ name: string }>
  dispatchUi: (action: JobModalUiAction) => void
}) {
  return (
    <>
      <JobTargetPlaceholder targetPlaceholder={targetPlaceholder} />
      <JobEntityPills
        form={form}
        variant={variant}
        isAdmin={isAdmin}
        customers={customers}
        customerRecents={customerRecents}
        customerSlug={customerSlug}
        selectedCustomer={selectedCustomer}
        customerCreateAffordance={customerCreateAffordance}
        targets={targets}
        targetRecents={targetRecents}
        selectedTarget={selectedTarget}
        targetCreateAffordance={targetCreateAffordance}
        triggerKind={triggerKind}
        cronExpression={cronExpression}
        intervalSeconds={intervalSeconds}
        triggerTimezone={triggerTimezone}
        dispatchUi={dispatchUi}
      />
      <JobTriggerSection
        form={form}
        variant={variant}
        initialJob={initialJob}
        customerSlug={customerSlug}
        selectedCustomer={selectedCustomer}
        triggerKind={triggerKind}
        cronExpression={cronExpression}
        intervalSeconds={intervalSeconds}
        triggerTimezone={triggerTimezone}
      />
      <JobVariablesSection form={form} selectedCustomer={selectedCustomer} />
      <JobBodySection form={form} selectedCustomer={selectedCustomer} secretNames={secretNames} />
    </>
  )
}

function JobTargetPlaceholder({ targetPlaceholder }: { targetPlaceholder: string | null }) {
  if (!targetPlaceholder) return null
  return (
    <p className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">
      This workspace template expects a Target for `{targetPlaceholder}`. Pick the matching Customer
      Target before creating the Job.
    </p>
  )
}

function JobEntityPills({
  form,
  variant,
  isAdmin,
  customers,
  customerRecents,
  customerSlug,
  selectedCustomer,
  customerCreateAffordance,
  targets,
  targetRecents,
  selectedTarget,
  targetCreateAffordance,
  triggerKind,
  cronExpression,
  intervalSeconds,
  triggerTimezone,
  dispatchUi,
}: {
  form: JobFormApi
  variant: 'create' | 'edit'
  isAdmin: boolean
  customers: CustomerOption[]
  customerRecents: CustomerOption[]
  customerSlug: string
  selectedCustomer: CustomerOption | null
  customerCreateAffordance: CreateAffordance
  targets: Target[]
  targetRecents: Target[]
  selectedTarget: Target | null
  targetCreateAffordance: CreateAffordance
  triggerKind: TriggerKind
  cronExpression: string
  intervalSeconds: number
  triggerTimezone: string
  dispatchUi: (action: JobModalUiAction) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchableCombobox<CustomerOption>
        label="Customer"
        required
        disabled={variant === 'edit'}
        items={customers}
        recents={customerRecents}
        value={selectedCustomer}
        onValueChange={(next) => {
          if (!next) return
          form.setFieldValue('customerSlug', next.slug)
          form.setFieldValue('triggerTimezone', next.timezone)
          form.setFieldValue('targetSlug', '')
        }}
        getId={(c) => c.slug}
        getLabel={(c) => c.name}
        getSecondary={(c) => c.slug}
        searchKeywords={(c) => [c.slug]}
        createAffordance={customerCreateAffordance}
      />
      {targets.length === 0 && customerSlug ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => dispatchUi({ type: 'target-create-opened' })}
          disabled={!isAdmin}
          className="rounded-full"
        >
          <Plus aria-hidden /> New Target
        </Button>
      ) : (
        <SearchableCombobox<Target>
          label="Target"
          required
          disabled={!customerSlug}
          items={targets}
          recents={targetRecents}
          value={selectedTarget}
          onValueChange={(next) => {
            if (!next) return
            form.setFieldValue('targetSlug', next.slug)
          }}
          getId={(t) => t.slug}
          getLabel={(t) => t.name}
          getSecondary={(t) => t.method}
          searchKeywords={(t) => [t.slug, t.url]}
          createAffordance={targetCreateAffordance}
        />
      )}
      <PillButton
        label="Trigger"
        value={triggerSummaryWithTimezone({
          triggerKind,
          cronExpression,
          intervalSeconds,
          triggerTimezone,
        })}
        state="filled"
      />
      <form.Subscribe selector={(s) => s.values.variables}>
        {(vars) => {
          const customerKeys = Object.keys(selectedCustomer?.variables ?? {}).length
          const jobKeys = Object.keys(vars).length
          return (
            <PillButton
              label="Variables"
              value={customerKeys + jobKeys === 0 ? 'None' : `${customerKeys + jobKeys} effective`}
              state={customerKeys + jobKeys === 0 ? 'empty' : 'filled'}
            />
          )
        }}
      </form.Subscribe>
      <form.Subscribe selector={(s) => s.values.bodyTemplate}>
        {(body) => (
          <PillButton
            label="Body"
            value={body ? 'Set' : 'Empty'}
            state={body ? 'filled' : 'empty'}
          />
        )}
      </form.Subscribe>
    </div>
  )
}

function JobTriggerSection({
  form,
  variant,
  initialJob,
  customerSlug,
  selectedCustomer,
  triggerKind,
  cronExpression,
  intervalSeconds,
  triggerTimezone,
}: {
  form: JobFormApi
  variant: 'create' | 'edit'
  initialJob: Job | undefined
  customerSlug: string
  selectedCustomer: CustomerOption | null
  triggerKind: TriggerKind
  cronExpression: string
  intervalSeconds: number
  triggerTimezone: string
}) {
  return (
    <section id="trigger-section" className="rounded-md border border-border bg-muted/20 p-3">
      <TriggerPicker
        value={{ triggerKind, cronExpression, intervalSeconds, triggerTimezone }}
        onChange={(next) => {
          form.setFieldValue('triggerKind', next.triggerKind)
          form.setFieldValue('cronExpression', next.cronExpression)
          form.setFieldValue('intervalSeconds', next.intervalSeconds)
          form.setFieldValue('triggerTimezone', next.triggerTimezone)
        }}
        customerSlug={customerSlug}
        customerTimezone={selectedCustomer?.timezone ?? 'UTC'}
        {...(variant === 'edit' && initialJob?.triggerKind === 'webhook'
          ? { webhookEditJobSlug: initialJob.slug }
          : {})}
      />
    </section>
  )
}

function JobVariablesSection({
  form,
  selectedCustomer,
}: {
  form: JobFormApi
  selectedCustomer: CustomerOption | null
}) {
  return (
    <section
      id="variables-section"
      className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3"
    >
      <p className="text-xs text-muted-foreground/70">
        Effective variables for this Job's templates. Customer-level entries are inherited; Job
        entries with the same name override.
      </p>
      <form.Field name="variables">
        {(field) => (
          <KeyValueListEditor
            rows={buildVariableRows(selectedCustomer?.variables ?? {}, field.state.value)}
            onChange={(next) => {
              const overridesAndJobOnly = next.filter(
                (r) => r.source !== 'customer' && r.name.length > 0,
              )
              field.handleChange(rowsToVariableMap(overridesAndJobOnly))
            }}
            addLabel="Add Job variable"
          />
        )}
      </form.Field>
    </section>
  )
}

function JobBodySection({
  form,
  selectedCustomer,
  secretNames,
}: {
  form: JobFormApi
  selectedCustomer: CustomerOption | null
  secretNames: Array<{ name: string }>
}) {
  return (
    <section id="body-section" className="rounded-md border border-border bg-muted/20 p-3">
      <form.Field name="bodyTemplate">
        {(field) => (
          <TemplateEditor
            id={field.name}
            label="Body"
            value={field.state.value}
            onChange={(v) => field.handleChange(v)}
            variant="body"
            customerName={selectedCustomer?.name ?? ''}
            customerTimezone={selectedCustomer?.timezone ?? 'UTC'}
            variables={buildAutocompleteVariables(
              selectedCustomer?.variables ?? {},
              form.state.values.variables,
            )}
            secrets={secretNames}
            helpText={BODY_HELP_TEXT}
          />
        )}
      </form.Field>
    </section>
  )
}
