import { useForm, useStore } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { toast } from 'sonner'
import { EntityModal } from '@/components/forms/EntityModal'
import type { FormApiFor } from '@/components/forms/form-api'
import {
  JobFormSections,
  JobIdentityFields,
  JobTemplateChooser,
} from '@/components/forms/JobModal.sections'
import { TargetModal } from '@/components/forms/TargetModal'
import { useSlugAutoFill } from '@/components/forms/use-slug-auto-fill'
import { WorkspaceModal } from '@/components/forms/WorkspaceModal'
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
import { workspaceSecretsQueryOptions } from '@/lib/workspace-secrets/query-options'
import type { Job, TriggerKind } from '@/shared/schemas/job'
import type { JobTemplate } from '@/shared/schemas/job-template'
import type { Target } from '@/shared/schemas/target'
import type { Workspace } from '@/shared/schemas/workspace'

export type WorkspaceOption = Pick<Workspace, 'slug' | 'name' | 'timezone' | 'variables'>

export interface JobFormValues {
  name: string
  slug: string
  workspaceSlug: string
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
  presetWorkspace?: WorkspaceOption
  workspaces: WorkspaceOption[]
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
  workspaceSlug: string
  fallbackTimezone: string
}

interface JobModalUiState {
  createAnother: boolean
  nestedTargetOpen: boolean
  nestedWorkspaceOpen: boolean
  nestedWorkspaceSeed: string
  view: 'form' | 'templates'
  targetPlaceholder: string | null
}

export type JobModalUiAction =
  | { type: 'create-another-changed'; enabled: boolean }
  | { type: 'target-create-opened' }
  | { type: 'target-create-closed' }
  | { type: 'workspace-create-opened'; seed: string }
  | { type: 'workspace-create-closed' }
  | { type: 'view-changed'; view: 'form' | 'templates' }
  | { type: 'template-applied'; targetPlaceholder: string | null }

const initialJobModalUiState: JobModalUiState = {
  createAnother: false,
  nestedTargetOpen: false,
  nestedWorkspaceOpen: false,
  nestedWorkspaceSeed: '',
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
    case 'workspace-create-opened':
      return { ...state, nestedWorkspaceOpen: true, nestedWorkspaceSeed: action.seed }
    case 'workspace-create-closed':
      return { ...state, nestedWorkspaceOpen: false, nestedWorkspaceSeed: '' }
    case 'view-changed':
      return { ...state, view: action.view }
    case 'template-applied':
      return { ...state, view: 'form', targetPlaceholder: action.targetPlaceholder }
  }
}

export function JobModal({
  variant,
  presetWorkspace,
  workspaces,
  initialJob,
  initialTargets,
  initialTemplateId,
  isAdmin,
  onClose,
}: JobModalProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const workspaceRecents = usePickerRecents<WorkspaceOption>(
    PICKER_KEYS.recentWorkspaces,
    workspaces,
    (c) => c.slug,
    PICKER_RECENT_LIMITS.workspaces,
  )
  const lastWorkspace = useLastUsed<WorkspaceOption>(
    PICKER_KEYS.lastWorkspace,
    workspaces,
    (c) => c.slug,
  )
  const switchthink = useMemo(
    () => workspaces.find((c) => c.slug === SWITCHTHINK_SLUG) ?? null,
    [workspaces],
  )
  const firstActive = workspaces[0] ?? null

  const workspaceDefault = useEntityDefault<WorkspaceOption>({
    urlSourceValue: variant === 'edit' ? null : (presetWorkspace ?? null),
    lastUsedValue: variant === 'edit' ? null : lastWorkspace.lastUsed,
    fallbackChain: variant === 'edit' ? [] : [switchthink, firstActive],
  })

  const initialWorkspace = useMemo<WorkspaceOption | null>(() => {
    if (initialJob) {
      const fromList = workspaces.find((c) => c.slug === initialJob.workspaceSlug)
      return {
        slug: initialJob.workspaceSlug,
        name: initialJob.workspaceName,
        timezone: initialJob.workspaceTimezone,
        variables: fromList?.variables ?? {},
      }
    }
    return workspaceDefault
  }, [initialJob, workspaceDefault, workspaces])

  const startSlug = initialJob?.slug ?? ''
  const slug = useSlugAutoFill(variant === 'edit')
  const [uiState, dispatchUi] = useReducer(jobModalUiReducer, initialJobModalUiState)
  const {
    createAnother,
    nestedTargetOpen,
    nestedWorkspaceOpen,
    nestedWorkspaceSeed,
    view,
    targetPlaceholder,
  } = uiState

  const form = useForm({
    defaultValues: {
      name: initialJob?.name ?? '',
      slug: startSlug,
      workspaceSlug: initialWorkspace?.slug ?? '',
      targetSlug: initialJob?.targetSlug ?? initialTargets?.[0]?.slug ?? '',
      triggerKind: initialJob?.triggerKind ?? 'cron',
      cronExpression: initialJob?.cronExpression ?? DEFAULT_CRON,
      intervalSeconds: initialJob?.intervalSeconds ?? DEFAULT_INTERVAL,
      triggerTimezone: initialJob?.triggerTimezone ?? initialWorkspace?.timezone ?? 'UTC',
      bodyTemplate: initialJob?.bodyTemplate ?? '',
      headersTemplate: initialJob?.headersTemplate ?? '{}',
      variables: initialJob?.variables ?? {},
      maxAttempts: initialJob?.maxAttempts ?? 3,
      overallDeadlineMs: initialJob?.overallDeadlineMs ?? 60_000,
    } satisfies JobFormValues,
    validators: {
      onSubmitAsync: async ({ value }) => {
        if (!value.workspaceSlug) return { fields: { workspaceSlug: 'Pick a Workspace' } }
        if (!value.targetSlug) return { fields: { targetSlug: 'Pick a Target' } }
        if (!value.name.trim()) return { fields: { name: 'Name is required' } }
        if (!value.slug.trim()) return { fields: { slug: 'Slug is required' } }

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
                  workspaceSlug: value.workspaceSlug,
                  slug: value.slug,
                  ...base,
                } as never,
              })
            : await updateJobFn({
                data: {
                  workspaceSlug: value.workspaceSlug,
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

        const submittedWorkspace = workspaces.find((c) => c.slug === value.workspaceSlug)
        if (submittedWorkspace) {
          lastWorkspace.recordUse(submittedWorkspace)
          workspaceRecents.recordUse(submittedWorkspace)
        }
        const submittedTarget = targets.find((t) => t.slug === value.targetSlug)
        if (submittedTarget) {
          lastTarget.recordUse(submittedTarget)
          targetRecents.recordUse(submittedTarget)
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['jobs'] }),
          queryClient.invalidateQueries({ queryKey: ['workspaces', value.workspaceSlug] }),
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
          to: '/jobs/$jobSlug',
          params: { jobSlug: result.data.slug },
        })
        return null
      },
    },
  })

  const workspaceSlug = useStore(form.store, (s) => s.values.workspaceSlug)
  const triggerKind = useStore(form.store, (s) => s.values.triggerKind)
  const cronExpression = useStore(form.store, (s) => s.values.cronExpression)
  const intervalSeconds = useStore(form.store, (s) => s.values.intervalSeconds)
  const triggerTimezone = useStore(form.store, (s) => s.values.triggerTimezone)
  const isDirty = useStore(form.store, (s) => s.isDirty)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)
  const formError = useStore(form.store, (s) => s.errorMap.onSubmit)

  const targetsQuery = useQuery({
    ...listTargetsQueryOptions(workspaceSlug),
    enabled: workspaceSlug.length > 0,
    ...(workspaceSlug === initialWorkspace?.slug && initialTargets
      ? { initialData: initialTargets }
      : {}),
  })
  const targets = targetsQuery.data ?? []

  const secretsQuery = useQuery({
    ...workspaceSecretsQueryOptions(workspaceSlug),
    enabled: workspaceSlug.length > 0,
  })
  const templatesQuery = useQuery({
    ...listJobTemplatesQueryOptions(workspaceSlug || undefined),
    enabled: variant === 'create',
  })
  const secretNames = useMemo(
    () => (secretsQuery.data?.secrets ?? []).map((s) => ({ name: s.name })),
    [secretsQuery.data],
  )

  const targetRecents = usePickerRecents<Target>(
    PICKER_KEYS.recentTargets(workspaceSlug),
    targets,
    (t) => t.slug,
    PICKER_RECENT_LIMITS.targets,
  )
  const lastTarget = useLastUsed<Target>(
    PICKER_KEYS.lastTarget(workspaceSlug),
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

  const selectedWorkspace =
    workspaces.find((c) => c.slug === workspaceSlug) ?? initialWorkspace ?? null
  const selectedTarget = targets.find((t) => t.slug === form.state.values.targetSlug) ?? null

  const applyTemplate = useCallback(
    ({ template, workspaceSlug, fallbackTimezone }: TemplateApplyOptions) => {
      const input = instantiateFromTemplate(template, workspaceSlug)
      const trigger = input.trigger

      form.setFieldValue('name', input.name)
      form.setFieldValue('slug', slugify(input.name))
      form.setFieldValue('workspaceSlug', input.workspaceSlug)
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
        targetPlaceholder: template.builtIn ? template.targetRef : null,
      })
    },
    [form],
  )

  useEffect(() => {
    if (!initialTemplateId || variant !== 'create') return
    const template = templatesQuery.data?.find((t) => t.id === initialTemplateId)
    if (!template) return
    const templateWorkspaceSlug = workspaceSlug || selectedWorkspace?.slug
    if (!templateWorkspaceSlug) return
    applyTemplate({
      template,
      workspaceSlug: templateWorkspaceSlug,
      fallbackTimezone: selectedWorkspace?.timezone ?? 'UTC',
    })
  }, [
    initialTemplateId,
    templatesQuery.data,
    variant,
    workspaceSlug,
    selectedWorkspace,
    applyTemplate,
  ])

  const workspaceCreateAffordance = isAdmin
    ? {
        enabled: true,
        onCreate: (query: string) => dispatchUi({ type: 'workspace-create-opened', seed: query }),
      }
    : { enabled: false, disabledReason: ADMIN_ONLY_REASON, onCreate: () => {} }

  const targetCreateAffordance = {
    enabled: true,
    onCreate: () => dispatchUi({ type: 'target-create-opened' }),
  }

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
          workspaceSlug={workspaceSlug}
          selectedWorkspace={selectedWorkspace}
          dispatchUi={dispatchUi}
          applyTemplate={applyTemplate}
        />
        {view === 'form' ? (
          <JobFormSections
            form={jobForm}
            variant={variant}
            initialJob={initialJob}
            workspaces={workspaces}
            workspaceRecents={workspaceRecents.recents}
            workspaceSlug={workspaceSlug}
            selectedWorkspace={selectedWorkspace}
            workspaceCreateAffordance={workspaceCreateAffordance}
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

      {nestedTargetOpen && workspaceSlug ? (
        <TargetModal
          variant="create"
          workspaceSlug={workspaceSlug}
          onClose={() => dispatchUi({ type: 'target-create-closed' })}
          onCreated={async (target) => {
            await queryClient.invalidateQueries({
              queryKey: ['workspaces', workspaceSlug, 'targets'],
            })
            form.setFieldValue('targetSlug', target.slug)
            dispatchUi({ type: 'target-create-closed' })
          }}
        />
      ) : null}

      {nestedWorkspaceOpen ? (
        <WorkspaceModal
          variant="create"
          onClose={() => dispatchUi({ type: 'workspace-create-closed' })}
          {...(nestedWorkspaceSeed ? { initialName: nestedWorkspaceSeed } : {})}
          onCreated={async (created) => {
            await queryClient.invalidateQueries({ queryKey: ['workspaces'] })
            form.setFieldValue('workspaceSlug', created.slug)
            form.setFieldValue('triggerTimezone', created.timezone)
            form.setFieldValue('targetSlug', '')
            dispatchUi({ type: 'workspace-create-closed' })
          }}
        />
      ) : null}
    </EntityModal>
  )
}
