import { useForm, useStore } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { ChannelModal } from '@/components/forms/ChannelModal'
import { EntityModal } from '@/components/forms/EntityModal'
import { MultiSearchableCombobox } from '@/components/forms/MultiSearchableCombobox'
import { SingleSelectPill } from '@/components/forms/SingleSelectPill'
import { useSlugAutoFill } from '@/components/forms/use-slug-auto-fill'
import { Input } from '@/components/ui/input'
import { createAlertRuleFn, updateAlertRuleFn } from '@/lib/alert-rules/server-fns'
import { listChannelsForPickerFn } from '@/lib/channels/server-fns'
import { PICKER_KEYS, PICKER_RECENT_LIMITS } from '@/lib/forms/picker-keys'
import { usePickerRecents } from '@/lib/forms/use-picker-recents'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import {
  type AlertRule,
  type AlertRuleKind,
  CONSECUTIVE_FAILURES_DEFAULT_COUNT,
  MISSED_SCHEDULE_DEFAULT_MINUTES,
  MISSED_SCHEDULE_MAX_MINUTES,
  MISSED_SCHEDULE_MIN_MINUTES,
  SLOW_RUN_DEFAULT_MS,
} from '@/shared/schemas/alert-rule'
import type { Channel } from '@/shared/schemas/channel'

export type AlertRuleModalOwner = { workspaceSlug: string }

interface KindOption {
  kind: AlertRuleKind
  label: string
  description: string
}

const KIND_OPTIONS: KindOption[] = [
  { kind: 'first_failure', label: 'First failure', description: 'After a green Job fails' },
  {
    kind: 'consecutive_failures',
    label: 'Consecutive failures',
    description: 'Streak of N non-success Runs',
  },
  { kind: 'recovery', label: 'Recovery', description: 'First success after a failure streak' },
  { kind: 'slow_run', label: 'Slow run', description: 'Run duration exceeds a threshold' },
  {
    kind: 'missed_schedule',
    label: 'Silence alert',
    description: 'No Run starts within a window',
  },
]

const MISSED_SCHEDULE_PRESETS = [
  { label: '1h', minutes: 60 },
  { label: '6h', minutes: 6 * 60 },
  { label: '1d', minutes: 24 * 60 },
  { label: '1w', minutes: 7 * 24 * 60 },
  { label: '2w', minutes: 14 * 24 * 60 },
] as const

function missedSchedulePresetClassName(active: boolean): string {
  const base = 'rounded-full border px-2.5 py-1 text-xs transition-colors'
  if (active) return `${base} border-primary bg-primary text-primary-foreground`
  return `${base} border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground`
}

interface AlertRuleFormValues {
  name: string
  slug: string
  kind: AlertRuleKind
  count: number
  thresholdMs: number
  silenceThresholdMinutes: number
  channelIds: string[]
}

function initialValues(rule: AlertRule | undefined): AlertRuleFormValues {
  if (!rule) {
    return {
      name: '',
      slug: '',
      kind: 'first_failure',
      count: CONSECUTIVE_FAILURES_DEFAULT_COUNT,
      thresholdMs: SLOW_RUN_DEFAULT_MS,
      silenceThresholdMinutes: MISSED_SCHEDULE_DEFAULT_MINUTES,
      channelIds: [],
    }
  }
  const count =
    rule.config.kind === 'consecutive_failures'
      ? rule.config.count
      : CONSECUTIVE_FAILURES_DEFAULT_COUNT
  const thresholdMs =
    rule.config.kind === 'slow_run' ? rule.config.threshold_ms : SLOW_RUN_DEFAULT_MS
  const silenceThresholdMinutes =
    rule.config.kind === 'missed_schedule'
      ? rule.config.silence_threshold_minutes
      : MISSED_SCHEDULE_DEFAULT_MINUTES
  return {
    name: rule.name,
    slug: rule.slug,
    kind: rule.kind,
    count,
    thresholdMs,
    silenceThresholdMinutes,
    channelIds: rule.channelIds,
  }
}

function buildConfig(values: AlertRuleFormValues) {
  switch (values.kind) {
    case 'first_failure':
      return { kind: 'first_failure' as const }
    case 'consecutive_failures':
      return { kind: 'consecutive_failures' as const, count: values.count }
    case 'recovery':
      return { kind: 'recovery' as const }
    case 'slow_run':
      return { kind: 'slow_run' as const, threshold_ms: values.thresholdMs }
    case 'missed_schedule':
      return {
        kind: 'missed_schedule' as const,
        silence_threshold_minutes: values.silenceThresholdMinutes,
      }
  }
}

interface AlertRuleModalProps {
  variant: 'create' | 'edit'
  owner: AlertRuleModalOwner
  initialRule?: AlertRule
  isAdmin: boolean
  onClose: () => void
}

const ADMIN_ONLY_REASON = 'Admin only'

export function AlertRuleModal({
  variant,
  owner,
  initialRule,
  isAdmin,
  onClose,
}: AlertRuleModalProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const slug = useSlugAutoFill(variant === 'edit')
  const [nestedChannelOpen, setNestedChannelOpen] = useState(false)

  const pickerQuery = useQuery<Channel[]>({
    queryKey: ['workspaces', owner.workspaceSlug, 'channels', 'picker'],
    queryFn: () => listChannelsForPickerFn({ data: { workspaceSlug: owner.workspaceSlug } }),
  })
  const activeChannels = (pickerQuery.data ?? []).filter((c) => c.status === 'active')

  const recentKey = PICKER_KEYS.recentChannels(owner.workspaceSlug)
  const channelRecents = usePickerRecents<Channel>(
    recentKey,
    activeChannels,
    (c) => c.id,
    PICKER_RECENT_LIMITS.channels,
  )

  const form = useForm({
    defaultValues: initialValues(initialRule),
    validators: {
      onSubmitAsync: async ({ value }) => {
        if (value.channelIds.length === 0) {
          return { fields: { channelIds: 'Pick at least one Channel' } }
        }
        const base = {
          name: value.name,
          config: buildConfig(value),
          channelIds: value.channelIds,
        }
        const workspaceSlug = owner.workspaceSlug
        const result: MutationResult<AlertRule> =
          variant === 'create'
            ? await createAlertRuleFn({
                data: { workspaceSlug, slug: value.slug, ...base } as never,
              })
            : await updateAlertRuleFn({
                data: { workspaceSlug, ruleSlug: initialRule?.slug ?? '', ...base } as never,
              })
        if (!result.ok) {
          return {
            ...(result.message ? { form: result.message } : {}),
            fields: fieldErrorsToTanstack(result.fieldErrors),
          }
        }
        await queryClient.invalidateQueries({
          queryKey: ['workspaces', owner.workspaceSlug, 'alert-rules'],
        })
        const channelById = new Map(activeChannels.map((channel) => [channel.id, channel]))
        for (const id of value.channelIds) {
          const channel = channelById.get(id)
          if (channel) channelRecents.recordUse(channel)
        }
        toast.success(variant === 'create' ? `Alert rule ${result.data.name} created` : 'Saved')
        await navigate({ to: '/' })
        return null
      },
    },
  })

  const isDirty = useStore(form.store, (s) => s.isDirty)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)
  const kind = useStore(form.store, (s) => s.values.kind)
  const channelIds = useStore(form.store, (s) => s.values.channelIds)
  const formError = useStore(form.store, (s) => s.errorMap.onSubmit)
  const selectedKindOption = KIND_OPTIONS.find((o) => o.kind === kind) ?? KIND_OPTIONS[0]
  const selectedChannelIds = new Set(channelIds)
  const selectedChannels = activeChannels.filter((c) => selectedChannelIds.has(c.id))

  const channelCreateAffordance = isAdmin
    ? { enabled: true, onCreate: () => setNestedChannelOpen(true) }
    : { enabled: false, disabledReason: ADMIN_ONLY_REASON, onCreate: () => {} }

  return (
    <EntityModal
      open
      onClose={onClose}
      title={variant === 'create' ? 'New Alert Rule' : `Edit ${initialRule?.name ?? 'Alert Rule'}`}
      dirty={isDirty && !isSubmitting}
      primaryAction={{
        label: variant === 'create' ? 'Create Alert Rule' : 'Save changes',
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
                placeholder="Name this rule…"
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
            items={KIND_OPTIONS}
            selected={selectedKindOption}
            getKey={(o) => o.kind}
            getPrimary={(o) => o.label}
            getSecondary={(o) => o.description}
            onSelect={(o) => form.setFieldValue('kind', o.kind)}
          />
          <MultiSearchableCombobox<Channel>
            label="Channels"
            required
            items={activeChannels}
            recents={channelRecents.recents}
            value={selectedChannels}
            onValueChange={(next) =>
              form.setFieldValue(
                'channelIds',
                next.map((c) => c.id),
              )
            }
            getId={(c) => c.id}
            getLabel={(c) => c.name}
            getSecondary={(c) => <span>{c.kind}</span>}
            searchKeywords={(c) => [c.slug, c.kind]}
            createAffordance={channelCreateAffordance}
            emptyMessage="No active Channels yet."
          />
        </div>

        {kind === 'consecutive_failures' ? (
          <form.Field name="count">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                  Consecutive failures (count, 2-50)
                </label>
                <Input
                  id={field.name}
                  type="number"
                  min={2}
                  max={50}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Number(e.currentTarget.value))}
                  className="max-w-[160px]"
                />
              </div>
            )}
          </form.Field>
        ) : null}

        {kind === 'slow_run' ? (
          <form.Field name="thresholdMs">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                  Threshold (ms, minimum 1000)
                </label>
                <Input
                  id={field.name}
                  type="number"
                  min={1000}
                  step={1000}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Number(e.currentTarget.value))}
                  className="max-w-[200px]"
                />
                {field.state.value > 600_000 ? (
                  <p className="text-xs text-warning">
                    Heads up: a threshold above 10 minutes will rarely fire for short Jobs.
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>
        ) : null}

        {kind === 'missed_schedule' ? (
          <form.Field name="silenceThresholdMinutes">
            {(field) => (
              <div className="flex flex-col gap-2">
                <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                  Window without a Run
                </label>
                <div className="flex flex-wrap gap-2">
                  {MISSED_SCHEDULE_PRESETS.map((preset) => {
                    const active = field.state.value === preset.minutes
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className={missedSchedulePresetClassName(active)}
                        onClick={() => field.handleChange(preset.minutes)}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
                <Input
                  id={field.name}
                  type="number"
                  min={MISSED_SCHEDULE_MIN_MINUTES}
                  max={MISSED_SCHEDULE_MAX_MINUTES}
                  step={1}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Number(e.currentTarget.value))}
                  className="max-w-[220px]"
                />
                <p className="text-xs text-muted-foreground">
                  Alerts when no Run starts in this window. Endpoint failures use Consecutive
                  failures.
                </p>
              </div>
            )}
          </form.Field>
        ) : null}

        {formError ? <p className="text-sm text-destructive">{String(formError)}</p> : null}
      </form>

      {nestedChannelOpen ? (
        <ChannelModal
          variant="create"
          owner={owner}
          onClose={() => setNestedChannelOpen(false)}
          onCreated={async (channel) => {
            await queryClient.invalidateQueries({
              queryKey: ['workspaces', owner.workspaceSlug, 'channels'],
            })
            form.setFieldValue('channelIds', [...form.state.values.channelIds, channel.id])
            setNestedChannelOpen(false)
          }}
        />
      ) : null}
    </EntityModal>
  )
}
