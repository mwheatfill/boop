import { useForm, useStore } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { EntityModal } from '@/components/forms/EntityModal'
import { PillButton } from '@/components/forms/PillPicker'
import { TargetModal } from '@/components/forms/TargetModal'
import { TemplateEditor } from '@/components/forms/TemplateEditor'
import { TriggerPicker } from '@/components/forms/TriggerPicker'
import { useSlugAutoFill } from '@/components/forms/use-slug-auto-fill'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { triggerSummary } from '@/lib/jobs/format'
import { createJobFn, updateJobFn } from '@/lib/jobs/server-fns'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import { listTargetsQueryOptions } from '@/lib/targets/query-options'
import type { Customer } from '@/shared/schemas/customer'
import type { Job, TriggerKind } from '@/shared/schemas/job'
import type { Target } from '@/shared/schemas/target'

type CustomerOption = Pick<Customer, 'slug' | 'name' | 'timezone'>

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
  maxAttempts: number
  overallDeadlineMs: number
}

interface JobModalProps {
  variant: 'create' | 'edit'
  presetCustomer?: CustomerOption
  customers: CustomerOption[]
  initialJob?: Job
  initialTargets?: Target[]
  onClose: () => void
}

const DEFAULT_CRON = '0 9 * * *'
const DEFAULT_INTERVAL = 300

export function JobModal({
  variant,
  presetCustomer,
  customers,
  initialJob,
  initialTargets,
  onClose,
}: JobModalProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const initialCustomer = useMemo<CustomerOption | null>(() => {
    if (initialJob) {
      return {
        slug: initialJob.customerSlug,
        name: initialJob.customerName,
        timezone: initialJob.customerTimezone,
      }
    }
    return presetCustomer ?? null
  }, [initialJob, presetCustomer])

  const startSlug = initialJob?.slug ?? ''
  const slug = useSlugAutoFill(variant === 'edit')
  const [createAnother, setCreateAnother] = useState(false)
  const [nestedTargetOpen, setNestedTargetOpen] = useState(false)
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [targetPickerOpen, setTargetPickerOpen] = useState(false)

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

  useEffect(() => {
    const current = form.state.values.targetSlug
    if (!current) return
    if (!targets.some((t) => t.slug === current)) {
      form.setFieldValue('targetSlug', '')
    }
  }, [targets, form])

  const selectedCustomer = customers.find((c) => c.slug === customerSlug) ?? initialCustomer ?? null
  const selectedTarget = targets.find((t) => t.slug === form.state.values.targetSlug)

  return (
    <EntityModal
      open
      onClose={onClose}
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
          <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
            <PopoverTrigger
              render={
                <PillButton
                  label="Customer"
                  value={selectedCustomer?.name}
                  state={selectedCustomer ? 'filled' : 'empty'}
                  required
                  disabled={variant === 'edit'}
                />
              }
            />
            <PopoverContent className="w-64 p-1">
              <ul className="flex max-h-64 flex-col gap-px overflow-y-auto">
                {customers.map((c) => (
                  <li key={c.slug}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        form.setFieldValue('customerSlug', c.slug)
                        form.setFieldValue('triggerTimezone', c.timezone)
                        setCustomerPickerOpen(false)
                      }}
                    >
                      <span>{c.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{c.slug}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>

          <Popover open={targetPickerOpen} onOpenChange={setTargetPickerOpen}>
            <PopoverTrigger
              render={
                <PillButton
                  label="Target"
                  value={selectedTarget?.name}
                  state={selectedTarget ? 'filled' : 'empty'}
                  required
                  disabled={!customerSlug}
                />
              }
            />
            <PopoverContent className="w-72 p-1">
              {targets.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  No Targets yet for this Customer.
                </p>
              ) : (
                <ul className="flex max-h-56 flex-col gap-px overflow-y-auto">
                  {targets.map((t) => (
                    <li key={t.slug}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          form.setFieldValue('targetSlug', t.slug)
                          setTargetPickerOpen(false)
                        }}
                      >
                        <span>{t.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{t.method}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-1 border-t border-border pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    setTargetPickerOpen(false)
                    setNestedTargetOpen(true)
                  }}
                >
                  <Plus aria-hidden /> New Target
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <PillButton
            label="Trigger"
            value={triggerSummary({ triggerKind, cronExpression, intervalSeconds })}
            state="filled"
            expanded
            aria-controls="trigger-section"
          />

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
                helpText="LiquidJS. Available: {{ run_id }}, {{ attempt_number }}, {{ customer_name }}, {{ customer_timezone }}, {{ now }}."
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
    </EntityModal>
  )
}
