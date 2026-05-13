import { useForm, useStore } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { toast } from 'sonner'
import { CustomerModal } from '@/components/forms/CustomerModal'
import { EntityModal } from '@/components/forms/EntityModal'
import type { FormApiFor } from '@/components/forms/form-api'
import {
  JobFormSections,
  JobIdentityFields,
  JobTemplateChooser,
} from '@/components/forms/JobModal.sections'
import { TargetModal } from '@/components/forms/TargetModal'
import { useSlugAutoFill } from '@/components/forms/use-slug-auto-fill'
import { customerSecretsQueryOptions } from '@/lib/customer-secrets/query-options'
import { PICKER_KEYS, PICKER_RECENT_LIMITS } from '@/lib/forms/picker-keys'
import { useEntityDefault } from '@/lib/forms/use-entity-default'
import { useLastUsed } from '@/lib/forms/use-last-used'
import { usePickerRecents } from '@/lib/forms/use-picker-recents'
import { instantiateFromTemplate } from '@/lib/job-templates/instantiate'
import { listJobTemplatesQueryOptions } from '@/lib/job-templates/query-options'
import { createJobFn, updateJobFn } from '@/lib/jobs/server-fns'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import { listTargetsQueryOptions } from '@/lib/targets/query-options'
import type { Customer } from '@/shared/schemas/customer'
import type { Job, TriggerKind } from '@/shared/schemas/job'
import type { JobTemplate } from '@/shared/schemas/job-template'
import type { Target } from '@/shared/schemas/target'

export type CustomerOption = Pick<Customer, 'slug' | 'name' | 'timezone' | 'variables'>

export interface JobFormValues {
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

export type JobFormApi = FormApiFor<JobFormValues>

interface JobModalProps {
  variant: 'create' | 'edit'
  presetCustomer?: CustomerOption
  customers: CustomerOption[]
  initialJob?: Job
  initialTargets?: Target[]
  initialTemplateId?: string | undefined
  isAdmin: boolean
  onClose: () => void
}

const DEFAULT_CRON = '0 9 * * *'
const DEFAULT_INTERVAL = 300
const SWITCHTHINK_SLUG = 'switchthink'
const ADMIN_ONLY_REASON = 'Admin only'

export type TemplateApplyOptions = {
  template: JobTemplate
  customerSlug: string
  fallbackTimezone: string
}

interface JobModalUiState {
  createAnother: boolean
  nestedTargetOpen: boolean
  nestedCustomerOpen: boolean
  nestedCustomerSeed: string
  view: 'form' | 'templates'
  targetPlaceholder: string | null
}

export type JobModalUiAction =
  | { type: 'create-another-changed'; enabled: boolean }
  | { type: 'target-create-opened' }
  | { type: 'target-create-closed' }
  | { type: 'customer-create-opened'; seed: string }
  | { type: 'customer-create-closed' }
  | { type: 'view-changed'; view: 'form' | 'templates' }
  | { type: 'template-applied'; targetPlaceholder: string | null }

const initialJobModalUiState: JobModalUiState = {
  createAnother: false,
  nestedTargetOpen: false,
  nestedCustomerOpen: false,
  nestedCustomerSeed: '',
  view: 'form',
  targetPlaceholder: null,
}

function jobModalUiReducer(state: JobModalUiState, action: JobModalUiAction): JobModalUiState {
  switch (action.type) {
    case 'create-another-changed':
      return { ...state, createAnother: action.enabled }
    case 'target-create-opened':
      return { ...state, nestedTargetOpen: true }
    case 'target-create-closed':
      return { ...state, nestedTargetOpen: false }
    case 'customer-create-opened':
      return { ...state, nestedCustomerOpen: true, nestedCustomerSeed: action.seed }
    case 'customer-create-closed':
      return { ...state, nestedCustomerOpen: false, nestedCustomerSeed: '' }
    case 'view-changed':
      return { ...state, view: action.view }
    case 'template-applied':
      return { ...state, view: 'form', targetPlaceholder: action.targetPlaceholder }
  }
}

export function JobModal({
  variant,
  presetCustomer,
  customers,
  initialJob,
  initialTargets,
  initialTemplateId,
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
  const [uiState, dispatchUi] = useReducer(jobModalUiReducer, initialJobModalUiState)
  const {
    createAnother,
    nestedTargetOpen,
    nestedCustomerOpen,
    nestedCustomerSeed,
    view,
    targetPlaceholder,
  } = uiState

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

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['jobs'] }),
          queryClient.invalidateQueries({ queryKey: ['customers', value.customerSlug] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        ])

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
  const templatesQuery = useQuery({
    ...listJobTemplatesQueryOptions(customerSlug || undefined),
    enabled: variant === 'create',
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

  const applyTemplate = useCallback(
    ({ template, customerSlug, fallbackTimezone }: TemplateApplyOptions) => {
      const input = instantiateFromTemplate(template, customerSlug)
      const trigger = input.trigger

      form.setFieldValue('name', input.name)
      form.setFieldValue('slug', slugify(input.name))
      form.setFieldValue('customerSlug', input.customerSlug)
      form.setFieldValue('targetSlug', input.targetSlug)
      form.setFieldValue('triggerKind', trigger.triggerKind)
      form.setFieldValue(
        'cronExpression',
        trigger.triggerKind === 'cron' ? trigger.cronExpression : DEFAULT_CRON,
      )
      form.setFieldValue(
        'intervalSeconds',
        trigger.triggerKind === 'interval' ? trigger.intervalSeconds : DEFAULT_INTERVAL,
      )
      form.setFieldValue(
        'triggerTimezone',
        trigger.triggerKind === 'cron' ? trigger.triggerTimezone : fallbackTimezone,
      )
      form.setFieldValue('bodyTemplate', input.bodyTemplate)
      form.setFieldValue('headersTemplate', input.headersTemplate)
      form.setFieldValue('variables', input.variables ?? {})
      form.setFieldValue('maxAttempts', input.maxAttempts)
      form.setFieldValue('overallDeadlineMs', input.overallDeadlineMs)
      dispatchUi({
        type: 'template-applied',
        targetPlaceholder: template.scope === 'workspace' ? template.targetRef : null,
      })
    },
    [form],
  )

  useEffect(() => {
    if (!initialTemplateId || variant !== 'create') return
    const template = templatesQuery.data?.find((t) => t.id === initialTemplateId)
    if (!template) return
    const templateCustomerSlug = customerSlug || selectedCustomer?.slug
    if (!templateCustomerSlug) return
    applyTemplate({
      template,
      customerSlug: templateCustomerSlug,
      fallbackTimezone: selectedCustomer?.timezone ?? 'UTC',
    })
  }, [
    initialTemplateId,
    templatesQuery.data,
    variant,
    customerSlug,
    selectedCustomer,
    applyTemplate,
  ])

  const customerCreateAffordance = isAdmin
    ? {
        enabled: true,
        onCreate: (query: string) => dispatchUi({ type: 'customer-create-opened', seed: query }),
      }
    : { enabled: false, disabledReason: ADMIN_ONLY_REASON, onCreate: () => {} }

  const targetCreateAffordance = isAdmin
    ? {
        enabled: true,
        onCreate: () => dispatchUi({ type: 'target-create-opened' }),
      }
    : { enabled: false, disabledReason: ADMIN_ONLY_REASON, onCreate: () => {} }

  const jobForm = form as unknown as JobFormApi

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
        ? {
            createAnother: {
              enabled: createAnother,
              onChange: (enabled: boolean) =>
                dispatchUi({ type: 'create-another-changed', enabled }),
            },
          }
        : {})}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <JobIdentityFields form={jobForm} slug={slug} variant={variant} />
        <JobTemplateChooser
          variant={variant}
          view={view}
          templates={templatesQuery.data ?? []}
          customerSlug={customerSlug}
          selectedCustomer={selectedCustomer}
          dispatchUi={dispatchUi}
          applyTemplate={applyTemplate}
        />
        {view === 'form' ? (
          <JobFormSections
            form={jobForm}
            variant={variant}
            initialJob={initialJob}
            isAdmin={isAdmin}
            customers={customers}
            customerRecents={customerRecents.recents}
            customerSlug={customerSlug}
            selectedCustomer={selectedCustomer}
            customerCreateAffordance={customerCreateAffordance}
            targets={targets}
            targetRecents={targetRecents.recents}
            selectedTarget={selectedTarget}
            targetCreateAffordance={targetCreateAffordance}
            targetPlaceholder={targetPlaceholder}
            triggerKind={triggerKind}
            cronExpression={cronExpression}
            intervalSeconds={intervalSeconds}
            triggerTimezone={triggerTimezone}
            secretNames={secretNames}
            dispatchUi={dispatchUi}
          />
        ) : null}

        {formError ? <p className="text-sm text-destructive">{String(formError)}</p> : null}
      </form>

      {nestedTargetOpen && customerSlug ? (
        <TargetModal
          variant="create"
          customerSlug={customerSlug}
          onClose={() => dispatchUi({ type: 'target-create-closed' })}
          onCreated={async (target) => {
            await queryClient.invalidateQueries({
              queryKey: ['customers', customerSlug, 'targets'],
            })
            form.setFieldValue('targetSlug', target.slug)
            dispatchUi({ type: 'target-create-closed' })
          }}
        />
      ) : null}

      {nestedCustomerOpen ? (
        <CustomerModal
          variant="create"
          onClose={() => dispatchUi({ type: 'customer-create-closed' })}
          {...(nestedCustomerSeed ? { initialName: nestedCustomerSeed } : {})}
          onCreated={async (created) => {
            await queryClient.invalidateQueries({ queryKey: ['customers'] })
            form.setFieldValue('customerSlug', created.slug)
            form.setFieldValue('triggerTimezone', created.timezone)
            form.setFieldValue('targetSlug', '')
            dispatchUi({ type: 'customer-create-closed' })
          }}
        />
      ) : null}
    </EntityModal>
  )
}
