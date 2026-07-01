import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Plus } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { toast } from 'sonner'
import { Section } from '@/components/Section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { normalizeFieldErrors, useAppForm } from '@/hooks/use-app-form'
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
  CONSECUTIVE_FAILURES_MAX,
  CONSECUTIVE_FAILURES_MIN,
  MISSED_SCHEDULE_DEFAULT_MINUTES,
  MISSED_SCHEDULE_MAX_MINUTES,
  MISSED_SCHEDULE_MIN_MINUTES,
  SLOW_RUN_DEFAULT_MS,
  SLOW_RUN_MIN_MS,
} from '@/shared/schemas/alert-rule'
import type { Channel } from '@/shared/schemas/channel'
import { ChannelSheet } from './ChannelSheet'
import { useSlugAutoFill } from './use-slug-auto-fill'

interface KindOption {
  kind: AlertRuleKind
  label: string
  description: string
}

const KIND_OPTIONS: ReadonlyArray<KindOption> = [
  { kind: 'first_failure', label: 'First failure', description: 'After a green Job fails' },
  {
    kind: 'consecutive_failures',
    label: 'Consecutive failures',
    description: 'Several failed Runs in a row',
  },
  { kind: 'recovery', label: 'Recovery', description: 'First success after a failure streak' },
  { kind: 'slow_run', label: 'Slow run', description: 'A Run takes longer than a set time' },
  { kind: 'missed_schedule', label: 'Silence alert', description: 'No Run starts within a window' },
]

const KIND_SELECT_OPTIONS = KIND_OPTIONS.map((o) => ({ value: o.kind, label: o.label }))

const MISSED_SCHEDULE_PRESETS = [
  { label: '1h', minutes: 60 },
  { label: '6h', minutes: 6 * 60 },
  { label: '1d', minutes: 24 * 60 },
  { label: '1w', minutes: 7 * 24 * 60 },
  { label: '2w', minutes: 14 * 24 * 60 },
] as const

function presetClassName(active: boolean): string {
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
  return {
    name: rule.name,
    slug: rule.slug,
    kind: rule.kind,
    count:
      rule.config.kind === 'consecutive_failures'
        ? rule.config.count
        : CONSECUTIVE_FAILURES_DEFAULT_COUNT,
    thresholdMs: rule.config.kind === 'slow_run' ? rule.config.threshold_ms : SLOW_RUN_DEFAULT_MS,
    silenceThresholdMinutes:
      rule.config.kind === 'missed_schedule'
        ? rule.config.silence_threshold_minutes
        : MISSED_SCHEDULE_DEFAULT_MINUTES,
    channelIds: rule.channelIds,
  }
}

function buildConfig(v: AlertRuleFormValues) {
  switch (v.kind) {
    case 'first_failure':
      return { kind: 'first_failure' as const }
    case 'consecutive_failures':
      return { kind: 'consecutive_failures' as const, count: v.count }
    case 'recovery':
      return { kind: 'recovery' as const }
    case 'slow_run':
      return { kind: 'slow_run' as const, threshold_ms: v.thresholdMs }
    case 'missed_schedule':
      return {
        kind: 'missed_schedule' as const,
        silence_threshold_minutes: v.silenceThresholdMinutes,
      }
  }
}

export interface AlertRuleSheetProps {
  owner: { workspaceSlug: string }
  rule?: AlertRule
  isAdmin?: boolean
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Nested create: when set, the created AlertRule is returned here instead of toasting. */
  onCreated?: (rule: AlertRule) => void | Promise<void>
}

export function AlertRuleSheet({
  owner,
  rule,
  isAdmin = false,
  trigger,
  open: openProp,
  onOpenChange,
  onCreated,
}: AlertRuleSheetProps) {
  const isEdit = !!rule
  const queryClient = useQueryClient()
  const slug = useSlugAutoFill(isEdit)
  const channelAnchor = useComboboxAnchor()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const pickerQuery = useQuery<Channel[]>({
    queryKey: ['workspaces', owner.workspaceSlug, 'channels', 'picker'],
    queryFn: () => listChannelsForPickerFn({ data: { workspaceSlug: owner.workspaceSlug } }),
  })
  const activeChannels = (pickerQuery.data ?? []).filter((c) => c.status === 'active')
  const channelRecents = usePickerRecents<Channel>(
    PICKER_KEYS.recentChannels(owner.workspaceSlug),
    activeChannels,
    (c) => c.id,
    PICKER_RECENT_LIMITS.channels,
  )
  const recentIds = new Set(channelRecents.recents.map((c) => c.id))
  const orderedChannels = [
    ...channelRecents.recents,
    ...activeChannels.filter((c) => !recentIds.has(c.id)),
  ]

  const form = useAppForm({
    defaultValues: initialValues(rule),
    validators: {
      onSubmitAsync: async ({ value }) => {
        if (value.channelIds.length === 0) {
          return { fields: { channelIds: 'Pick at least one Channel' } }
        }
        const base = { name: value.name, config: buildConfig(value), channelIds: value.channelIds }
        const result: MutationResult<AlertRule> = isEdit
          ? await updateAlertRuleFn({
              data: { workspaceSlug: owner.workspaceSlug, ruleSlug: rule.slug, ...base } as never,
            })
          : await createAlertRuleFn({
              data: { workspaceSlug: owner.workspaceSlug, slug: value.slug, ...base } as never,
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
        const channelById = new Map(activeChannels.map((c) => [c.id, c]))
        for (const id of value.channelIds) {
          const channel = channelById.get(id)
          if (channel) channelRecents.recordUse(channel)
        }
        setOpen(false)
        if (!isEdit && onCreated) {
          await onCreated(result.data)
        } else {
          toast.success(isEdit ? 'Saved' : `Alert rule ${result.data.name} created`)
        }
        return null
      },
    },
  })

  function handleOpenChange(next: boolean) {
    if (next) {
      if (isEdit) slug.markManual()
      else slug.reset()
      form.reset()
    }
    setOpen(next)
  }

  const kindLabel = KIND_OPTIONS.find((o) => o.kind === rule?.kind)?.label

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-lg">
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
              <Bell className="size-5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <SheetTitle className="truncate text-base">
                {isEdit ? rule.name : 'New Alert Rule'}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {isEdit
                  ? 'Edit when this rule alerts, and where it goes'
                  : 'Sends finished Runs to your Channels'}
              </SheetDescription>
            </div>
            {isEdit && kindLabel ? (
              <Badge variant="secondary" className="shrink-0">
                {kindLabel}
              </Badge>
            ) : null}
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
            <Section title="Identity">
              <form.AppField
                name="name"
                listeners={{
                  onChange: ({ value }) => {
                    if (!slug.isManual()) form.setFieldValue('slug', slugify(value))
                  },
                }}
              >
                {(f) => <f.TextField label="Name" placeholder="Alert on first failure" autoFocus />}
              </form.AppField>
              <form.AppField name="slug">
                {(f) => (
                  <Field>
                    <FieldLabel htmlFor={f.name}>Slug</FieldLabel>
                    <input
                      id={f.name}
                      value={f.state.value}
                      readOnly={isEdit}
                      onChange={(e) => {
                        slug.markManual()
                        f.handleChange(e.currentTarget.value)
                      }}
                      onBlur={f.handleBlur}
                      placeholder="alert-on-first-failure"
                      className="h-9 rounded-md border border-input bg-transparent px-3 font-mono text-xs shadow-xs read-only:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:bg-input/30"
                    />
                    <FieldDescription>
                      {isEdit ? "Slug can't change after creation." : 'Used in URLs and the API.'}
                    </FieldDescription>
                  </Field>
                )}
              </form.AppField>
            </Section>

            <Section
              title="Condition"
              hint="The condition that decides when this rule sends an alert."
            >
              <form.AppField name="kind">
                {(f) =>
                  isEdit ? (
                    <Field>
                      <FieldLabel>Kind</FieldLabel>
                      <p className="text-sm">{kindLabel}</p>
                      <FieldDescription>Kind can't change after creation.</FieldDescription>
                    </Field>
                  ) : (
                    <f.SelectField label="Kind" options={KIND_SELECT_OPTIONS} />
                  )
                }
              </form.AppField>

              <form.Subscribe selector={(s) => s.values.kind}>
                {(kind) => {
                  const description = KIND_OPTIONS.find((o) => o.kind === kind)?.description
                  return (
                    <>
                      {!isEdit && description ? (
                        <p className="text-xs text-muted-foreground">{description}</p>
                      ) : null}

                      {kind === 'consecutive_failures' ? (
                        <form.AppField name="count">
                          {(f) => (
                            <Field>
                              <FieldLabel htmlFor={f.name}>Consecutive failures</FieldLabel>
                              <Input
                                id={f.name}
                                type="number"
                                min={CONSECUTIVE_FAILURES_MIN}
                                max={CONSECUTIVE_FAILURES_MAX}
                                value={f.state.value}
                                onChange={(e) => f.handleChange(Number(e.currentTarget.value))}
                                onBlur={f.handleBlur}
                                className="max-w-[160px]"
                              />
                              <FieldDescription>
                                Count between {CONSECUTIVE_FAILURES_MIN} and{' '}
                                {CONSECUTIVE_FAILURES_MAX}.
                              </FieldDescription>
                            </Field>
                          )}
                        </form.AppField>
                      ) : null}

                      {kind === 'slow_run' ? (
                        <form.AppField name="thresholdMs">
                          {(f) => (
                            <Field>
                              <FieldLabel htmlFor={f.name}>Threshold (ms)</FieldLabel>
                              <Input
                                id={f.name}
                                type="number"
                                min={SLOW_RUN_MIN_MS}
                                step={1000}
                                value={f.state.value}
                                onChange={(e) => f.handleChange(Number(e.currentTarget.value))}
                                onBlur={f.handleBlur}
                                className="max-w-[200px]"
                              />
                              {f.state.value > 600_000 ? (
                                <p className="text-xs text-warning">
                                  Heads up: a threshold above 10 minutes will rarely fire for short
                                  Jobs.
                                </p>
                              ) : (
                                <FieldDescription>Minimum {SLOW_RUN_MIN_MS}ms.</FieldDescription>
                              )}
                            </Field>
                          )}
                        </form.AppField>
                      ) : null}

                      {kind === 'missed_schedule' ? (
                        <form.AppField name="silenceThresholdMinutes">
                          {(f) => (
                            <Field>
                              <FieldLabel htmlFor={f.name}>
                                How long with no Runs before alerting
                              </FieldLabel>
                              <div className="flex flex-wrap gap-2">
                                {MISSED_SCHEDULE_PRESETS.map((preset) => (
                                  <button
                                    key={preset.label}
                                    type="button"
                                    className={presetClassName(f.state.value === preset.minutes)}
                                    onClick={() => f.handleChange(preset.minutes)}
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                              <Input
                                id={f.name}
                                type="number"
                                min={MISSED_SCHEDULE_MIN_MINUTES}
                                max={MISSED_SCHEDULE_MAX_MINUTES}
                                step={1}
                                value={f.state.value}
                                onChange={(e) => f.handleChange(Number(e.currentTarget.value))}
                                onBlur={f.handleBlur}
                                className="max-w-[220px]"
                              />
                              <FieldDescription>
                                Minutes. Alerts when no Run starts in this time. For failures from
                                the target, use Consecutive failures.
                              </FieldDescription>
                            </Field>
                          )}
                        </form.AppField>
                      ) : null}
                    </>
                  )
                }}
              </form.Subscribe>
            </Section>

            <Section title="Channels" hint="Where matching Runs are sent.">
              <form.AppField name="channelIds">
                {(f) => {
                  const selectedIds = new Set(f.state.value)
                  const selectedChannels = activeChannels.filter((c) => selectedIds.has(c.id))
                  const errors = normalizeFieldErrors(f.state.meta.errors)
                  return (
                    <Field data-invalid={errors.length > 0 || undefined}>
                      <Combobox
                        items={orderedChannels}
                        multiple
                        value={selectedChannels}
                        onValueChange={(next) =>
                          f.handleChange(((next as Channel[] | null) ?? []).map((c) => c.id))
                        }
                        itemToStringLabel={(c: Channel) => c.name}
                        isItemEqualToValue={(a: Channel, b: Channel) => a.id === b.id}
                      >
                        <ComboboxChips
                          ref={channelAnchor}
                          aria-invalid={errors.length > 0 || undefined}
                        >
                          <ComboboxValue>
                            {(value: Channel[]) => (
                              <>
                                {value.map((c) => (
                                  <ComboboxChip key={c.id} aria-label={c.name}>
                                    {c.name}
                                  </ComboboxChip>
                                ))}
                                <ComboboxChipsInput
                                  placeholder={value.length > 0 ? '' : 'Search Channels…'}
                                />
                              </>
                            )}
                          </ComboboxValue>
                        </ComboboxChips>
                        <ComboboxContent anchor={channelAnchor}>
                          <ComboboxEmpty>No active Channels yet.</ComboboxEmpty>
                          <ComboboxList>
                            {(c: Channel) => (
                              <ComboboxItem key={c.id} value={c}>
                                <span className="truncate">{c.name}</span>
                                <span className="ml-auto font-mono text-xs text-muted-foreground">
                                  {c.kind}
                                </span>
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                      <FieldError errors={errors} />
                    </Field>
                  )
                }}
              </form.AppField>

              {isAdmin ? (
                <ChannelSheet
                  owner={owner}
                  trigger={
                    <Button type="button" variant="outline" size="sm" className="self-start">
                      <Plus aria-hidden /> New Channel
                    </Button>
                  }
                  onCreated={async (channel) => {
                    await queryClient.invalidateQueries({
                      queryKey: ['workspaces', owner.workspaceSlug, 'channels'],
                    })
                    form.setFieldValue('channelIds', [...form.state.values.channelIds, channel.id])
                  }}
                />
              ) : null}
            </Section>

            <form.Subscribe selector={(s) => s.errorMap.onSubmit}>
              {(formError) => (formError ? <FieldError>{String(formError)}</FieldError> : null)}
            </form.Subscribe>
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t p-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <form.AppForm>
              <form.SubmitButton>{isEdit ? 'Save changes' : 'Create Alert Rule'}</form.SubmitButton>
            </form.AppForm>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
