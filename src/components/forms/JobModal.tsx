import { useForm, useStore } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CustomerModal } from '@/components/forms/CustomerModal'
import { EntityModal } from '@/components/forms/EntityModal'
import {
  KeyValueListEditor,
  type KeyValueRow,
  rowsToVariableMap,
} from '@/components/forms/KeyValueListEditor'
import { PillButton } from '@/components/forms/PillPicker'
import { SearchableCombobox } from '@/components/forms/SearchableCombobox'
import { TargetModal } from '@/components/forms/TargetModal'
import { TemplateEditor } from '@/components/forms/TemplateEditor'
import { TriggerPicker } from '@/components/forms/TriggerPicker'
import { useSlugAutoFill } from '@/components/forms/use-slug-auto-fill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { customerSecretsQueryOptions } from '@/lib/customer-secrets/query-options'
import { PICKER_KEYS, PICKER_RECENT_LIMITS } from '@/lib/forms/picker-keys'
import { useEntityDefault } from '@/lib/forms/use-entity-default'
import { useLastUsed } from '@/lib/forms/use-last-used'
import { usePickerRecents } from '@/lib/forms/use-picker-recents'
import { triggerSummary } from '@/lib/jobs/format'
import { createJobFn, updateJobFn } from '@/lib/jobs/server-fns'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import { listTargetsQueryOptions } from '@/lib/targets/query-options'
import type { Customer } from '@/shared/schemas/customer'
import type { Job, TriggerKind } from '@/shared/schemas/job'
import type { Target } from '@/shared/schemas/target'

type CustomerOption = Pick<Customer, 'slug' | 'name' | 'timezone' | 'variables'>

interface JobFormValues {
  name: string
  slug: string
  customerSlug: string
  targetSlug: string
  triggerKind: TriggerKind
  cronExpression: string
  intervalSeconds: number
  triggerTimezone: string
  bodyTemplate: string
  headersTemplate: string
  variables: Record<string, string>
  maxAttempts: number
  overallDeadlineMs: number
}

interface JobModalProps {
  variant: 'create' | 'edit'
  presetCustomer?: CustomerOption
  customers: CustomerOption[]
  initialJob?: Job
  initialTargets?: Target[]
  isAdmin: boolean
  onClose: () => void
}

const DEFAULT_CRON = '0 9 * * *'
const DEFAULT_INTERVAL = 300
const SWITCHTHINK_SLUG = 'switchthink'
const ADMIN_ONLY_REASON = 'Admin only'

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

export function JobModal({
  variant,
  presetCustomer,
  customers,
  initialJob,
  initialTargets,
  isAdmin,
  onClose,
}: JobModalProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const customerRecents = usePickerRecents<CustomerOption>(
    PICKER_KEYS.recentCustomers,
    customers,
    (c) => c.slug,
    PICKER_RECENT_LIMITS.customers,
  )
  const lastCustomer = useLastUsed<CustomerOption>(
    PICKER_KEYS.lastCustomer,
    customers,
    (c) => c.slug,
  )
  const switchthink = useMemo(
    () => customers.find((c) => c.slug === SWITCHTHINK_SLUG) ?? null,
    [customers],
  )
  const firstActive = customers[0] ?? null

  const customerDefault = useEntityDefault<CustomerOption>({
    urlSourceValue: variant === 'edit' ? null : (presetCustomer ?? null),
    lastUsedValue: variant === 'edit' ? null : lastCustomer.lastUsed,
    fallbackChain: variant === 'edit' ? [] : [switchthink, firstActive],
  })

  const initialCustomer = useMemo<CustomerOption | null>(() => {
    if (initialJob) {
      const fromList = customers.find((c) => c.slug === initialJob.customerSlug)
      return {
        slug: initialJob.customerSlug,
        name: initialJob.customerName,
        timezone: initialJob.customerTimezone,
        variables: fromList?.variables ?? {},
      }
    }
    return customerDefault
  }, [initialJob, customerDefault, customers])

  const startSlug = initialJob?.slug ?? ''
  const slug = useSlugAutoFill(variant === 'edit')
  const [createAnother, setCreateAnother] = useState(false)
  const [nestedTargetOpen, setNestedTargetOpen] = useState(false)
  const [nestedCustomerOpen, setNestedCustomerOpen] = useState(false)
  const [nestedCustomerSeed, setNestedCustomerSeed] = useState('')

  const form = useForm({
    defaultValues: {
      name: initialJob?.name ?? '',
      slug: startSlug,
      customerSlug: initialCustomer?.slug ?? '',
      targetSlug: initialJob?.targetSlug ?? initialTargets?.[0]?.slug ?? '',
      triggerKind: initialJob?.triggerKind ?? 'cron',
      cronExpression: initialJob?.cronExpression ?? DEFAULT_CRON,
      intervalSeconds: initialJob?.intervalSeconds ?? DEFAULT_INTERVAL,
      triggerTimezone: initialJob?.triggerTimezone ?? initialCustomer?.timezone ?? 'UTC',
      bodyTemplate: initialJob?.bodyTemplate ?? '',
      headersTemplate: initialJob?.headersTemplate ?? '{}',
      variables: initialJob?.variables ?? {},
      maxAttempts: initialJob?.maxAttempts ?? 3,
      overallDeadlineMs: initialJob?.overallDeadlineMs ?? 60_000,
    } satisfies JobFormValues,
    validators: {
      onSubmitAsync: async ({ value }) => {
        if (!value.customerSlug) return { fields: { customerSlug: 'Pick a Customer' } }
        if (!value.targetSlug) return { fields: { targetSlug: 'Pick a Target' } }

        const trigger =
          value.triggerKind === 'cron'
            ? {
                triggerKind: 'cron' as const,
                cronExpression: value.cronExpression,
                triggerTimezone: value.triggerTimezone,
              }
            : value.triggerKind === 'interval'
              ? { triggerKind: 'interval' as const, intervalSeconds: value.intervalSeconds }
              : { triggerKind: 'webhook' as const }

        const base = {
          name: value.name,
          targetSlug: value.targetSlug,
          bodyTemplate: value.bodyTemplate,
          headersTemplate: value.headersTemplate,
          variables: value.variables,
          maxAttempts: value.maxAttempts,
          overallDeadlineMs: value.overallDeadlineMs,
          trigger,
        }

        const result: MutationResult<Job> =
          variant === 'create'
            ? await createJobFn({
                data: {
                  customerSlug: value.customerSlug,
                  slug: value.slug,
                  ...base,
                } as never,
              })
            : await updateJobFn({
                data: {
                  customerSlug: value.customerSlug,
                  jobSlug: startSlug,
                  ...base,
                } as never,
              })

        if (!result.ok) {
          return {
            ...(result.message ? { form: result.message } : {}),
            fields: fieldErrorsToTanstack(result.fieldErrors),
          }
        }

        const submittedCustomer = customers.find((c) => c.slug === value.customerSlug)
        if (submittedCustomer) {
          lastCustomer.recordUse(submittedCustomer)
          customerRecents.recordUse(submittedCustomer)
        }
        const submittedTarget = targets.find((t) => t.slug === value.targetSlug)
        if (submittedTarget) {
          lastTarget.recordUse(submittedTarget)
          targetRecents.recordUse(submittedTarget)
        }

        await queryClient.invalidateQueries({ queryKey: ['jobs'] })
        await queryClient.invalidateQueries({ queryKey: ['customers', value.customerSlug] })
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] })

        if (variant === 'create' && createAnother) {
          toast.success(`Job ${result.data.name} created`)
          form.setFieldValue('name', '')
          form.setFieldValue('slug', '')
          form.setFieldValue('bodyTemplate', '')
          slug.reset()
          form.reset({ ...form.state.values, name: '', slug: '', bodyTemplate: '' })
          return null
        }

        toast.success(variant === 'create' ? `Job ${result.data.name} created` : 'Saved')
        await navigate({
          to: '/customers/$customerSlug/jobs/$jobSlug',
          params: { customerSlug: value.customerSlug, jobSlug: result.data.slug },
        })
        return null
      },
    },
  })

  const customerSlug = useStore(form.store, (s) => s.values.customerSlug)
  const triggerKind = useStore(form.store, (s) => s.values.triggerKind)
  const cronExpression = useStore(form.store, (s) => s.values.cronExpression)
  const intervalSeconds = useStore(form.store, (s) => s.values.intervalSeconds)
  const triggerTimezone = useStore(form.store, (s) => s.values.triggerTimezone)
  const isDirty = useStore(form.store, (s) => s.isDirty)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)
  const formError = useStore(form.store, (s) => s.errorMap.onSubmit)

  const targetsQuery = useQuery({
    ...listTargetsQueryOptions(customerSlug),
    enabled: customerSlug.length > 0,
    ...(customerSlug === initialCustomer?.slug && initialTargets
      ? { initialData: initialTargets }
      : {}),
  })
  const targets = targetsQuery.data ?? []

  const secretsQuery = useQuery({
    ...customerSecretsQueryOptions(customerSlug),
    enabled: customerSlug.length > 0,
  })
  const secretNames = useMemo(
    () => (secretsQuery.data?.secrets ?? []).map((s) => ({ name: s.name })),
    [secretsQuery.data],
  )

  const targetRecents = usePickerRecents<Target>(
    PICKER_KEYS.recentTargets(customerSlug),
    targets,
    (t) => t.slug,
    PICKER_RECENT_LIMITS.targets,
  )
  const lastTarget = useLastUsed<Target>(
    PICKER_KEYS.lastTarget(customerSlug),
    targets,
    (t) => t.slug,
  )
  const soleTarget = targets.length === 1 ? (targets[0] ?? null) : null
  const targetDefault = useEntityDefault<Target>({
    urlSourceValue: null,
    lastUsedValue: variant === 'edit' ? null : lastTarget.lastUsed,
    fallbackChain: variant === 'edit' ? [] : [soleTarget],
  })

  useEffect(() => {
    const current = form.state.values.targetSlug
    if (variant === 'edit') return
    if (current && targets.some((t) => t.slug === current)) return
    if (targetDefault) {
      form.setFieldValue('targetSlug', targetDefault.slug)
    } else if (current && !targets.some((t) => t.slug === current)) {
      form.setFieldValue('targetSlug', '')
    }
  }, [targetDefault, targets, form, variant])

  const selectedCustomer = customers.find((c) => c.slug === customerSlug) ?? initialCustomer ?? null
  const selectedTarget = targets.find((t) => t.slug === form.state.values.targetSlug) ?? null

  const customerCreateAffordance = isAdmin
    ? {
        enabled: true,
        onCreate: (query: string) => {
          setNestedCustomerSeed(query)
          setNestedCustomerOpen(true)
        },
      }
    : { enabled: false, disabledReason: ADMIN_ONLY_REASON, onCreate: () => {} }

  const targetCreateAffordance = isAdmin
    ? {
        enabled: true,
        onCreate: () => setNestedTargetOpen(true),
      }
    : { enabled: false, disabledReason: ADMIN_ONLY_REASON, onCreate: () => {} }

  return (
    <EntityModal
      open
      onClose={onClose}
      size="wide"
      title={variant === 'create' ? 'New Job' : `Edit ${initialJob?.name ?? 'Job'}`}
      dirty={isDirty && !isSubmitting}
      primaryAction={{
        label: variant === 'create' ? 'Create Job' : 'Save changes',
        onClick: () => void form.handleSubmit(),
        loading: isSubmitting,
      }}
      {...(variant === 'create'
        ? { createAnother: { enabled: createAnother, onChange: setCreateAnother } }
        : {})}
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
                placeholder="Name this Job…"
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                autoFocus
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
                <p className="text-xs text-muted-foreground/70">
                  Slug can't change after creation.
                </p>
              ) : null}
            </div>
          )}
        </form.Field>

        <div className="flex flex-wrap items-center gap-2">
          <SearchableCombobox<CustomerOption>
            label="Customer"
            required
            disabled={variant === 'edit'}
            items={customers}
            recents={customerRecents.recents}
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
              onClick={() => setNestedTargetOpen(true)}
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
              recents={targetRecents.recents}
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
            value={triggerSummary({ triggerKind, cronExpression, intervalSeconds })}
            state="filled"
            expanded
            aria-controls="trigger-section"
          />

          <form.Subscribe selector={(s) => s.values.variables}>
            {(vars) => {
              const customerKeys = Object.keys(selectedCustomer?.variables ?? {}).length
              const jobKeys = Object.keys(vars).length
              return (
                <PillButton
                  label="Variables"
                  value={
                    customerKeys + jobKeys === 0 ? 'None' : `${customerKeys + jobKeys} effective`
                  }
                  state={customerKeys + jobKeys === 0 ? 'empty' : 'filled'}
                  expanded
                  aria-controls="variables-section"
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
                expanded
                aria-controls="body-section"
              />
            )}
          </form.Subscribe>
        </div>

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

        {formError ? <p className="text-sm text-destructive">{String(formError)}</p> : null}
      </form>

      {nestedTargetOpen && customerSlug ? (
        <TargetModal
          variant="create"
          customerSlug={customerSlug}
          onClose={() => setNestedTargetOpen(false)}
          onCreated={async (target) => {
            await queryClient.invalidateQueries({
              queryKey: ['customers', customerSlug, 'targets'],
            })
            form.setFieldValue('targetSlug', target.slug)
            setNestedTargetOpen(false)
          }}
        />
      ) : null}

      {nestedCustomerOpen ? (
        <CustomerModal
          variant="create"
          onClose={() => setNestedCustomerOpen(false)}
          {...(nestedCustomerSeed ? { initialName: nestedCustomerSeed } : {})}
          onCreated={async (created) => {
            await queryClient.invalidateQueries({ queryKey: ['customers'] })
            form.setFieldValue('customerSlug', created.slug)
            form.setFieldValue('triggerTimezone', created.timezone)
            form.setFieldValue('targetSlug', '')
            setNestedCustomerOpen(false)
          }}
        />
      ) : null}
    </EntityModal>
  )
}
