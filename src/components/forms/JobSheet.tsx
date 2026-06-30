import { useStore } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Activity,
  ChevronDown,
  Clock,
  Code2,
  Crosshair,
  LayoutTemplate,
  Pencil,
  Plus,
  Tag,
} from 'lucide-react'
import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Section } from '@/components/Section'
import { TargetPicker } from '@/components/targets/TargetPicker'
import { TargetSummary } from '@/components/targets/TargetSummary'
import { TemplateGallery } from '@/components/templates/TemplateGallery'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
import { listWorkspacesQueryOptions } from '@/lib/workspaces/query-options'
import type { Job, TriggerKind } from '@/shared/schemas/job'
import type { JobTemplate } from '@/shared/schemas/job-template'
import type { Target } from '@/shared/schemas/target'
import type { Workspace } from '@/shared/schemas/workspace'
import { KeyValueListEditor, type KeyValueRow, rowsToVariableMap } from './KeyValueListEditor'
import { TargetSheet } from './TargetSheet'
import { TemplateEditor } from './TemplateEditor'
import { TriggerPicker } from './TriggerPicker'
import { useSlugAutoFill } from './use-slug-auto-fill'
import { WorkspaceSheet } from './WorkspaceSheet'

const DEFAULT_CRON = '0 9 * * *'
const DEFAULT_INTERVAL = 300
const SWITCHTHINK_SLUG = 'switchthink'

const BODY_HELP_TEXT =
  'LiquidJS. Available: {{ run_id }}, {{ attempt_number }}, {{ workspace_name }}, {{ workspace_timezone }}, {{ now }}, plus operator-defined variables. {% boop_secret "name" %} pulls a Workspace secret when the Job runs.'

interface JobFormValues {
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

// Effective variable rows for the Job editor: Workspace entries are inherited
// (read-only), Job entries with a matching name show as overrides, the rest are
// Job-only. Only overrides and Job-only rows are written back to the Job.
function buildVariableRows(
  workspaceVars: Record<string, string>,
  jobVars: Record<string, string>,
): KeyValueRow[] {
  const fromWorkspace = Object.keys(workspaceVars)
    .sort()
    .map<KeyValueRow>((name) => {
      const workspaceValue = workspaceVars[name] ?? ''
      if (Object.hasOwn(jobVars, name)) {
        return {
          name,
          value: jobVars[name] ?? '',
          source: 'override',
          inherited: { from: 'workspace', value: workspaceValue },
        }
      }
      return { name, value: workspaceValue, source: 'workspace' }
    })
  const jobOnly = Object.keys(jobVars)
    .filter((k) => !Object.hasOwn(workspaceVars, k))
    .sort()
    .map<KeyValueRow>((name) => ({ name, value: jobVars[name] ?? '', source: 'job' }))
  return [...fromWorkspace, ...jobOnly]
}

function buildAutocompleteVariables(
  workspaceVars: Record<string, string>,
  jobVars: Record<string, string>,
): Array<{ name: string; value: string; source: 'workspace' | 'job' }> {
  return Object.entries({ ...workspaceVars, ...jobVars }).map(([name, value]) => ({
    name,
    value,
    source: Object.hasOwn(jobVars, name) ? 'job' : 'workspace',
  }))
}

export interface JobSheetProps {
  owner?: { workspaceSlug: string }
  job?: Job
  isAdmin?: boolean
  /** Pre-apply a Job template by id on open (create only). */
  initialTemplateId?: string
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Nested create: when set, the created Job is returned here instead of navigating. */
  onCreated?: (job: Job) => void | Promise<void>
}

export function JobSheet({
  owner,
  job,
  isAdmin = false,
  initialTemplateId,
  trigger,
  open: openProp,
  onOpenChange,
  onCreated,
}: JobSheetProps) {
  const isEdit = !!job
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const slug = useSlugAutoFill(isEdit)
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const [createAnother, setCreateAnother] = useState(false)
  const [view, setView] = useState<'form' | 'templates'>('form')
  const [targetPlaceholder, setTargetPlaceholder] = useState<string | null>(null)

  const { data: workspaces = [] } = useQuery(listWorkspacesQueryOptions(false))

  const workspaceRecents = usePickerRecents<Workspace>(
    PICKER_KEYS.recentWorkspaces,
    workspaces,
    (w) => w.slug,
    PICKER_RECENT_LIMITS.workspaces,
  )
  const lastWorkspace = useLastUsed<Workspace>(PICKER_KEYS.lastWorkspace, workspaces, (w) => w.slug)
  const switchthink = useMemo(
    () => workspaces.find((w) => w.slug === SWITCHTHINK_SLUG) ?? null,
    [workspaces],
  )
  const firstActive = workspaces[0] ?? null

  const ownerWorkspace = owner
    ? (workspaces.find((w) => w.slug === owner.workspaceSlug) ?? null)
    : null
  const workspaceDefault = useEntityDefault<Workspace>({
    urlSourceValue: isEdit ? null : ownerWorkspace,
    lastUsedValue: isEdit ? null : lastWorkspace.lastUsed,
    fallbackChain: isEdit ? [] : [switchthink, firstActive],
  })

  type WorkspaceLike = Pick<Workspace, 'slug' | 'name' | 'timezone' | 'variables'>
  const initialWorkspace = useMemo<WorkspaceLike | null>(() => {
    if (job) {
      const fromList = workspaces.find((w) => w.slug === job.workspaceSlug)
      return {
        slug: job.workspaceSlug,
        name: job.workspaceName,
        timezone: job.workspaceTimezone,
        variables: fromList?.variables ?? {},
      }
    }
    return workspaceDefault
  }, [job, workspaceDefault, workspaces])

  const startSlug = job?.slug ?? ''

  const buildDefaults = useCallback((): JobFormValues => {
    const ws = isEdit ? initialWorkspace : workspaceDefault
    return {
      name: job?.name ?? '',
      slug: startSlug,
      workspaceSlug: (isEdit ? job?.workspaceSlug : workspaceDefault?.slug) ?? '',
      targetSlug: job?.targetSlug ?? '',
      triggerKind: job?.triggerKind ?? 'cron',
      cronExpression: job?.cronExpression ?? '',
      intervalSeconds: job?.intervalSeconds ?? DEFAULT_INTERVAL,
      triggerTimezone: job?.triggerTimezone ?? ws?.timezone ?? 'UTC',
      bodyTemplate: job?.bodyTemplate ?? '',
      headersTemplate: job?.headersTemplate ?? '{}',
      variables: job?.variables ?? {},
      maxAttempts: job?.maxAttempts ?? 3,
      overallDeadlineMs: job?.overallDeadlineMs ?? 60_000,
    }
  }, [isEdit, initialWorkspace, workspaceDefault, job, startSlug])

  const form = useAppForm({
    defaultValues: buildDefaults(),
    validators: {
      onSubmitAsync: async ({ value }) => {
        if (!value.workspaceSlug) return { fields: { workspaceSlug: 'Pick a Workspace' } }
        if (!value.targetSlug) return { fields: { targetSlug: 'Pick a Target' } }
        if (!value.name.trim()) return { fields: { name: 'Name is required' } }
        if (!value.slug.trim()) return { fields: { slug: 'Slug is required' } }
        if (value.triggerKind === 'cron' && !value.cronExpression.trim())
          return 'Choose a schedule for this Job, or switch to Webhook.'

        const triggerInput =
          value.triggerKind === 'cron'
            ? {
                triggerKind: 'cron' as const,
                cronExpression: value.cronExpression,
                triggerTimezone: value.triggerTimezone,
              }
            : value.triggerKind === 'interval'
              ? { triggerKind: 'interval' as const, intervalSeconds: value.intervalSeconds }
              : value.triggerKind === 'manual'
                ? { triggerKind: 'manual' as const }
                : { triggerKind: 'webhook' as const }

        const base = {
          name: value.name,
          targetSlug: value.targetSlug,
          bodyTemplate: value.bodyTemplate,
          headersTemplate: value.headersTemplate,
          variables: value.variables,
          maxAttempts: value.maxAttempts,
          overallDeadlineMs: value.overallDeadlineMs,
          trigger: triggerInput,
        }

        const result: MutationResult<Job> = isEdit
          ? await updateJobFn({
              data: { workspaceSlug: value.workspaceSlug, jobSlug: startSlug, ...base } as never,
            })
          : await createJobFn({
              data: { workspaceSlug: value.workspaceSlug, slug: value.slug, ...base } as never,
            })

        if (!result.ok) {
          return {
            ...(result.message ? { form: result.message } : {}),
            fields: fieldErrorsToTanstack(result.fieldErrors),
          }
        }

        const submittedWorkspace = workspaces.find((w) => w.slug === value.workspaceSlug)
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

        if (!isEdit && createAnother) {
          toast.success(`Job ${result.data.name} created`)
          slug.reset()
          form.reset({ ...form.state.values, name: '', slug: '', bodyTemplate: '' })
          return null
        }

        setOpen(false)
        if (!isEdit && onCreated) {
          await onCreated(result.data)
          return null
        }
        toast.success(isEdit ? 'Saved' : `Job ${result.data.name} created`)
        await navigate({ to: '/jobs/$jobSlug', params: { jobSlug: result.data.slug } })
        return null
      },
    },
  })

  const workspaceSlug = useStore(form.store, (s) => s.values.workspaceSlug)
  const triggerKind = useStore(form.store, (s) => s.values.triggerKind)
  const cronExpression = useStore(form.store, (s) => s.values.cronExpression)
  const intervalSeconds = useStore(form.store, (s) => s.values.intervalSeconds)
  const triggerTimezone = useStore(form.store, (s) => s.values.triggerTimezone)

  const { data: targets = [] } = useQuery({
    ...listTargetsQueryOptions(workspaceSlug),
    enabled: workspaceSlug.length > 0,
  })
  const secretsQuery = useQuery({
    ...workspaceSecretsQueryOptions(workspaceSlug),
    enabled: workspaceSlug.length > 0,
  })
  const { data: templates = [] } = useQuery({
    ...listJobTemplatesQueryOptions(workspaceSlug || undefined),
    enabled: !isEdit,
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
    lastUsedValue: isEdit ? null : lastTarget.lastUsed,
    fallbackChain: isEdit ? [] : [soleTarget],
  })

  // Auto-select the default Workspace once the list loads (create only).
  useEffect(() => {
    if (isEdit) return
    if (form.state.values.workspaceSlug) return
    if (workspaceDefault) {
      form.setFieldValue('workspaceSlug', workspaceDefault.slug)
      form.setFieldValue('triggerTimezone', workspaceDefault.timezone)
    }
  }, [workspaceDefault, isEdit, form])

  // Default the Target once the Workspace's Targets load (create only).
  useEffect(() => {
    if (isEdit) return
    const current = form.state.values.targetSlug
    if (current && targets.some((t) => t.slug === current)) return
    if (targetDefault) {
      form.setFieldValue('targetSlug', targetDefault.slug)
    } else if (current && !targets.some((t) => t.slug === current)) {
      form.setFieldValue('targetSlug', '')
    }
  }, [targetDefault, targets, form, isEdit])

  const selectedWorkspace =
    workspaces.find((w) => w.slug === workspaceSlug) ?? initialWorkspace ?? null

  const applyTemplate = useCallback(
    (template: JobTemplate) => {
      const targetWorkspaceSlug = workspaceSlug || selectedWorkspace?.slug
      if (!targetWorkspaceSlug) return
      const input = instantiateFromTemplate(template, targetWorkspaceSlug)
      const triggerInput = input.trigger
      const fallbackTimezone = selectedWorkspace?.timezone ?? 'UTC'

      form.setFieldValue('name', input.name)
      form.setFieldValue('slug', slugify(input.name))
      form.setFieldValue('workspaceSlug', input.workspaceSlug)
      form.setFieldValue('targetSlug', input.targetSlug)
      form.setFieldValue('triggerKind', triggerInput.triggerKind)
      form.setFieldValue(
        'cronExpression',
        triggerInput.triggerKind === 'cron' ? triggerInput.cronExpression : DEFAULT_CRON,
      )
      form.setFieldValue(
        'intervalSeconds',
        triggerInput.triggerKind === 'interval' ? triggerInput.intervalSeconds : DEFAULT_INTERVAL,
      )
      form.setFieldValue(
        'triggerTimezone',
        triggerInput.triggerKind === 'cron' ? triggerInput.triggerTimezone : fallbackTimezone,
      )
      form.setFieldValue('bodyTemplate', input.bodyTemplate)
      form.setFieldValue('headersTemplate', input.headersTemplate)
      form.setFieldValue('variables', input.variables ?? {})
      form.setFieldValue('maxAttempts', input.maxAttempts)
      form.setFieldValue('overallDeadlineMs', input.overallDeadlineMs)
      setView('form')
      setTargetPlaceholder(template.builtIn ? template.targetRef : null)
    },
    [form, workspaceSlug, selectedWorkspace],
  )

  useEffect(() => {
    if (!initialTemplateId || isEdit || !open) return
    const template = templates.find((t) => t.id === initialTemplateId)
    if (template) applyTemplate(template)
  }, [initialTemplateId, templates, isEdit, open, applyTemplate])

  function handleOpenChange(next: boolean) {
    if (next) {
      if (isEdit) slug.markManual()
      else slug.reset()
      form.reset(buildDefaults())
      setView('form')
      setTargetPlaceholder(null)
      setCreateAnother(false)
    }
    setOpen(next)
  }

  const recentTargetSlugs = new Set(targetRecents.recents.map((t) => t.slug))
  const orderedTargets = [
    ...targetRecents.recents,
    ...targets.filter((t) => !recentTargetSlugs.has(t.slug)),
  ]

  const recentWorkspaceSlugs = new Set(workspaceRecents.recents.map((w) => w.slug))
  const workspaceOptions = [
    ...workspaceRecents.recents,
    ...workspaces.filter((w) => !recentWorkspaceSlugs.has(w.slug)),
  ].map((w) => ({ value: w.slug, label: w.name }))

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-2xl">
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
              <Activity className="size-5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <SheetTitle className="truncate text-base">
                {isEdit ? job.name : 'New Job'}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {isEdit ? 'Edit this scheduled web request' : 'A scheduled web request to a Target'}
              </SheetDescription>
            </div>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
            <Section icon={Tag} title="Identity">
              <form.AppField
                name="name"
                listeners={{
                  onChange: ({ value }) => {
                    if (!slug.isManual()) form.setFieldValue('slug', slugify(value))
                  },
                }}
              >
                {(f) => <f.TextField label="Name" placeholder="Nightly backup" autoFocus />}
              </form.AppField>
            </Section>

            {!isEdit ? (
              <Section icon={LayoutTemplate} title="Start from">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={view === 'form' ? 'default' : 'outline'}
                    onClick={() => setView('form')}
                  >
                    Start from scratch
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={view === 'templates' ? 'default' : 'outline'}
                    onClick={() => setView('templates')}
                  >
                    Use a template
                  </Button>
                </div>
                {view === 'templates' ? (
                  <TemplateGallery compact templates={templates} onSelect={applyTemplate} />
                ) : null}
              </Section>
            ) : null}

            {view === 'form' ? (
              <>
                {targetPlaceholder ? (
                  <p className="rounded-md border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">
                    This workspace template expects a Target for `{targetPlaceholder}`. Pick the
                    matching Workspace Target before creating the Job.
                  </p>
                ) : null}

                <Section icon={Crosshair} title="Target">
                  {workspaces.length > 1 ? (
                    isEdit ? (
                      <Field>
                        <FieldLabel>Workspace</FieldLabel>
                        <p className="text-sm">{selectedWorkspace?.name ?? job?.workspaceName}</p>
                        <FieldDescription>Workspace can't change after creation.</FieldDescription>
                      </Field>
                    ) : (
                      <>
                        <form.AppField
                          name="workspaceSlug"
                          listeners={{
                            onChange: ({ value }) => {
                              const ws = workspaces.find((w) => w.slug === value)
                              if (ws) form.setFieldValue('triggerTimezone', ws.timezone)
                              form.setFieldValue('targetSlug', '')
                            },
                          }}
                        >
                          {(f) => (
                            <f.SelectField
                              label="Workspace"
                              placeholder="Select a Workspace"
                              options={workspaceOptions}
                            />
                          )}
                        </form.AppField>
                        {isAdmin ? (
                          <WorkspaceSheet
                            trigger={
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="self-start"
                              >
                                <Plus aria-hidden /> New Workspace
                              </Button>
                            }
                            onCreated={async (created) => {
                              await queryClient.invalidateQueries({ queryKey: ['workspaces'] })
                              form.setFieldValue('workspaceSlug', created.slug)
                              form.setFieldValue('triggerTimezone', created.timezone)
                              form.setFieldValue('targetSlug', '')
                            }}
                          />
                        ) : null}
                      </>
                    )
                  ) : null}

                  {targets.length > 0 ? (
                    <form.AppField name="targetSlug">
                      {(f) => {
                        const selectedTarget = orderedTargets.find((t) => t.slug === f.state.value)
                        return (
                          <Field>
                            <FieldLabel>Target</FieldLabel>
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <TargetPicker
                                  targets={orderedTargets}
                                  value={f.state.value}
                                  onChange={(slug) => f.handleChange(slug)}
                                />
                              </div>
                              {isAdmin && selectedTarget ? (
                                <TargetSheet
                                  target={selectedTarget}
                                  owner={{ workspaceSlug }}
                                  trigger={
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      aria-label={`Edit ${selectedTarget.name}`}
                                    >
                                      <Pencil aria-hidden />
                                    </Button>
                                  }
                                />
                              ) : null}
                            </div>
                          </Field>
                        )
                      }}
                    </form.AppField>
                  ) : (
                    <Field>
                      <FieldLabel>Target</FieldLabel>
                      <FieldDescription>
                        {workspaceSlug
                          ? 'No Targets in this Workspace yet. Create one below.'
                          : 'Pick a Workspace first.'}
                      </FieldDescription>
                    </Field>
                  )}

                  {workspaceSlug ? (
                    <TargetSheet
                      owner={{ workspaceSlug }}
                      trigger={
                        <Button type="button" variant="outline" size="sm" className="self-start">
                          <Plus aria-hidden /> New Target
                        </Button>
                      }
                      onCreated={async (target) => {
                        await queryClient.invalidateQueries({
                          queryKey: ['workspaces', workspaceSlug, 'targets'],
                        })
                        form.setFieldValue('targetSlug', target.slug)
                      }}
                    />
                  ) : null}

                  <form.Subscribe selector={(s) => s.values.targetSlug}>
                    {(targetSlug) => {
                      const selected = targets.find((t) => t.slug === targetSlug)
                      return selected ? <TargetSummary target={selected} /> : null
                    }}
                  </form.Subscribe>
                </Section>

                <Section icon={Clock} title="Trigger">
                  <TriggerPicker
                    value={{ triggerKind, cronExpression, intervalSeconds, triggerTimezone }}
                    onChange={(next) => {
                      form.setFieldValue('triggerKind', next.triggerKind)
                      form.setFieldValue('cronExpression', next.cronExpression)
                      form.setFieldValue('intervalSeconds', next.intervalSeconds)
                      form.setFieldValue('triggerTimezone', next.triggerTimezone)
                    }}
                    workspaceSlug={workspaceSlug}
                    workspaceTimezone={selectedWorkspace?.timezone ?? 'UTC'}
                    {...(isEdit && job?.triggerKind === 'webhook'
                      ? { webhookEditJobSlug: job.slug }
                      : {})}
                  />
                </Section>

                <Card size="sm" className="shrink-0">
                  <Collapsible>
                    <CardHeader>
                      <CollapsibleTrigger className="group/req flex w-full cursor-pointer items-center justify-between gap-2 text-left">
                        <CardTitle className="flex items-center gap-2">
                          <Code2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          Request body & variables
                        </CardTitle>
                        <ChevronDown
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/req:rotate-180"
                          aria-hidden
                        />
                      </CollapsibleTrigger>
                      <CardDescription>
                        Optional. Only needed when the Job sends data. Most Jobs don't need this.
                      </CardDescription>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="flex flex-col gap-5">
                        <form.AppField name="bodyTemplate">
                          {(f) => (
                            <TemplateEditor
                              id={f.name}
                              label="Body"
                              value={f.state.value}
                              onChange={(v) => f.handleChange(v)}
                              variant="body"
                              workspaceName={selectedWorkspace?.name ?? ''}
                              workspaceTimezone={selectedWorkspace?.timezone ?? 'UTC'}
                              variables={buildAutocompleteVariables(
                                selectedWorkspace?.variables ?? {},
                                form.state.values.variables,
                              )}
                              secrets={secretNames}
                              helpText={BODY_HELP_TEXT}
                            />
                          )}
                        </form.AppField>
                        <form.AppField name="variables">
                          {(f) => (
                            <Field>
                              <FieldLabel>Variables</FieldLabel>
                              <KeyValueListEditor
                                rows={buildVariableRows(
                                  selectedWorkspace?.variables ?? {},
                                  f.state.value,
                                )}
                                onChange={(next) => {
                                  const overridesAndJobOnly = next.filter(
                                    (r) => r.source !== 'workspace' && r.name.length > 0,
                                  )
                                  f.handleChange(rowsToVariableMap(overridesAndJobOnly))
                                }}
                                addLabel="Add Job variable"
                              />
                              <FieldDescription>
                                Workspace variables are inherited; a Job entry with the same name
                                overrides it.
                              </FieldDescription>
                            </Field>
                          )}
                        </form.AppField>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              </>
            ) : null}

            <form.Subscribe selector={(s) => s.errorMap.onSubmit}>
              {(formError) => (formError ? <FieldError>{String(formError)}</FieldError> : null)}
            </form.Subscribe>
          </div>

          <SheetFooter
            className={`flex-row items-center gap-2 border-t p-4 ${
              isEdit ? 'justify-end' : 'justify-between'
            }`}
          >
            {!isEdit ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="job-create-another"
                  checked={createAnother}
                  onCheckedChange={(checked) => setCreateAnother(checked === true)}
                />
                <label htmlFor="job-create-another" className="text-sm text-muted-foreground">
                  Create another
                </label>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <form.AppForm>
                <form.SubmitButton>{isEdit ? 'Save changes' : 'Create Job'}</form.SubmitButton>
              </form.AppForm>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
