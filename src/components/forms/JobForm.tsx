import { useForm } from '@tanstack/react-form'
import { useRef, useState } from 'react'
import { CronPreview } from '@/components/forms/CronPreview'
import { firesPerDay, IntervalChips } from '@/components/forms/IntervalChips'
import { TemplateEditor } from '@/components/forms/TemplateEditor'
import { SlugField } from '@/components/SlugField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import type { Job, JobCreateInput, JobUpdateInput, TriggerKind } from '@/shared/schemas/job'
import type { Target } from '@/shared/schemas/target'

interface TargetOption {
  slug: Target['slug']
  name: Target['name']
}

export interface JobFormInitialValues {
  name: string
  slug: string
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

interface JobFormProps {
  variant: 'create' | 'edit'
  initialValues: JobFormInitialValues
  submitLabel: string
  targets: TargetOption[]
  customerName: string
  customerTimezone: string
  mutate: (value: JobCreateInput | JobUpdateInput) => Promise<MutationResult<Job>>
  onSuccess: (data: Job) => Promise<void> | void
}

function payloadFor(
  values: JobFormInitialValues,
  variant: 'create' | 'edit',
  initialSlug: string,
): JobCreateInput | JobUpdateInput {
  const triggerKind = values.triggerKind
  const trigger =
    triggerKind === 'cron'
      ? {
          triggerKind: 'cron' as const,
          cronExpression: values.cronExpression,
          triggerTimezone: values.triggerTimezone,
        }
      : triggerKind === 'interval'
        ? { triggerKind: 'interval' as const, intervalSeconds: values.intervalSeconds }
        : { triggerKind: 'webhook' as const }
  const base = {
    name: values.name,
    targetSlug: values.targetSlug,
    bodyTemplate: values.bodyTemplate,
    headersTemplate: values.headersTemplate,
    maxAttempts: values.maxAttempts,
    overallDeadlineMs: values.overallDeadlineMs,
    trigger,
  }
  return variant === 'create' ? { ...base, slug: values.slug } : { ...base, slug: initialSlug }
}

export function JobForm({
  variant,
  initialValues,
  submitLabel,
  targets,
  customerName,
  customerTimezone,
  mutate,
  onSuccess,
}: JobFormProps) {
  const slugManuallyEdited = useRef(variant === 'edit')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmitAsync: async ({ value }) => {
        const payload = payloadFor(value, variant, initialValues.slug)
        const result = await mutate(payload)
        if (!result.ok) {
          return {
            ...(result.message ? { form: result.message } : {}),
            fields: fieldErrorsToTanstack(result.fieldErrors),
          }
        }
        await onSuccess(result.data)
        return null
      },
    },
  })

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Identity
        </h2>
        <form.Field
          name="name"
          listeners={{
            onChange: ({ value }) => {
              if (slugManuallyEdited.current) return
              form.setFieldValue('slug', slugify(value))
            },
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>Name</Label>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
              />
              {field.state.meta.errors[0] ? (
                <p className="text-xs text-destructive">{String(field.state.meta.errors[0])}</p>
              ) : null}
            </div>
          )}
        </form.Field>

        <form.Field name="slug">
          {(field) => (
            <SlugField
              id={field.name}
              value={field.state.value}
              readOnly={variant === 'edit'}
              error={field.state.meta.errors[0] ? String(field.state.meta.errors[0]) : undefined}
              onChange={(next) => {
                slugManuallyEdited.current = true
                field.handleChange(next)
              }}
              helpText={
                variant === 'create'
                  ? 'Auto-filled from name. Read-only after create.'
                  : 'Slug is immutable after create.'
              }
            />
          )}
        </form.Field>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Target
        </h2>
        <form.Field name="targetSlug">
          {(field) => (
            <div className="flex flex-col gap-2">
              <Label htmlFor={field.name}>Target</Label>
              <Select
                value={field.state.value}
                onValueChange={(v) => {
                  if (v) field.handleChange(v)
                }}
              >
                <SelectTrigger id={field.name}>
                  <SelectValue placeholder="Select a Target" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((t) => (
                    <SelectItem key={t.slug} value={t.slug}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.state.meta.errors[0] ? (
                <p className="text-xs text-destructive">{String(field.state.meta.errors[0])}</p>
              ) : null}
            </div>
          )}
        </form.Field>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Trigger
        </h2>
        <form.Field name="triggerKind">
          {(field) => (
            <RadioGroup
              value={field.state.value}
              onValueChange={(v) => {
                if (v) field.handleChange(v as TriggerKind)
              }}
              className="flex flex-wrap gap-4"
            >
              {(['cron', 'interval', 'webhook'] as TriggerKind[]).map((kind) => (
                <div key={kind} className="flex items-center gap-2">
                  <RadioGroupItem id={`trigger-${kind}`} value={kind} />
                  <Label htmlFor={`trigger-${kind}`} className="capitalize">
                    {kind}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => s.values.triggerKind}>
          {(triggerKind) => {
            if (triggerKind === 'cron') {
              return (
                <div className="flex flex-col gap-3">
                  <form.Field name="cronExpression">
                    {(field) => (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>Cron expression</Label>
                        <Input
                          id={field.name}
                          value={field.state.value}
                          placeholder="0 9 * * 1-5"
                          onChange={(e) => field.handleChange(e.currentTarget.value)}
                          className="font-mono"
                        />
                        {field.state.meta.errors[0] ? (
                          <p className="text-xs text-destructive">
                            {String(field.state.meta.errors[0])}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </form.Field>
                  <form.Subscribe
                    selector={(s) => [s.values.cronExpression, s.values.triggerTimezone] as const}
                  >
                    {([expr, tz]) => <CronPreview expression={expr} timezone={tz} />}
                  </form.Subscribe>
                </div>
              )
            }
            if (triggerKind === 'interval') {
              return (
                <form.Field name="intervalSeconds">
                  {(field) => {
                    const fpd = firesPerDay(field.state.value)
                    return (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>Interval (seconds)</Label>
                        <Input
                          id={field.name}
                          type="number"
                          min={1}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(Number(e.currentTarget.value) || 0)}
                        />
                        <IntervalChips
                          value={field.state.value}
                          onChange={(s) => field.handleChange(s)}
                        />
                        <p className="text-xs text-muted-foreground">
                          ≈ {fpd.toLocaleString()} fires/day
                        </p>
                        {field.state.value > 0 && field.state.value < 60 ? (
                          <p className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs">
                            For intervals of one minute or more, prefer cron — same behavior,
                            cheaper.
                          </p>
                        ) : null}
                        {field.state.meta.errors[0] ? (
                          <p className="text-xs text-destructive">
                            {String(field.state.meta.errors[0])}
                          </p>
                        ) : null}
                      </div>
                    )
                  }}
                </form.Field>
              )
            }
            return (
              <p className="text-sm text-muted-foreground">
                Webhook Jobs fire on inbound HTTP POST. No schedule needed.
              </p>
            )
          }}
        </form.Subscribe>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Templates
        </h2>
        <form.Field name="bodyTemplate">
          {(field) => (
            <TemplateEditor
              id={field.name}
              label="Body"
              value={field.state.value}
              onChange={(v) => field.handleChange(v)}
              variant="body"
              customerName={customerName}
              customerTimezone={customerTimezone}
              helpText="LiquidJS. Available: {{ run_id }}, {{ attempt_number }}, {{ customer_name }}, {{ customer_timezone }}, {{ now }}."
            />
          )}
        </form.Field>
        <form.Field name="headersTemplate">
          {(field) => (
            <TemplateEditor
              id={field.name}
              label="Headers"
              value={field.state.value}
              onChange={(v) => field.handleChange(v)}
              variant="headers"
              customerName={customerName}
              customerTimezone={customerTimezone}
              helpText="Must render to a JSON object of string values."
              rows={4}
            />
          )}
        </form.Field>
      </section>

      <section className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="self-start text-sm font-medium underline-offset-4 hover:underline"
        >
          {advancedOpen ? 'Hide' : 'Show'} advanced options
        </button>
        {advancedOpen ? (
          <div className="flex flex-col gap-4 rounded-md border border-border p-4">
            <form.Subscribe selector={(s) => s.values.triggerKind}>
              {(triggerKind) =>
                triggerKind === 'cron' ? (
                  <form.Field name="triggerTimezone">
                    {(field) => (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={field.name}>Trigger timezone</Label>
                        <Input
                          id={field.name}
                          value={field.state.value}
                          placeholder="America/New_York"
                          onChange={(e) => field.handleChange(e.currentTarget.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Inherits the Customer timezone ({customerTimezone}) when blank.
                        </p>
                      </div>
                    )}
                  </form.Field>
                ) : null
              }
            </form.Subscribe>
            <form.Field name="maxAttempts">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={field.name}>Max attempts</Label>
                  <Input
                    id={field.name}
                    type="number"
                    min={1}
                    max={10}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Number(e.currentTarget.value) || 1)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="overallDeadlineMs">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={field.name}>Overall deadline (ms)</Label>
                  <Input
                    id={field.name}
                    type="number"
                    min={1000}
                    step={1000}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Number(e.currentTarget.value) || 60_000)}
                  />
                </div>
              )}
            </form.Field>
          </div>
        ) : null}
      </section>

      <form.Subscribe selector={(s) => [s.isSubmitting, s.errorMap.onSubmit] as const}>
        {([isSubmitting, formError]) => (
          <div className="flex flex-col gap-2">
            {formError ? <p className="text-sm text-destructive">{String(formError)}</p> : null}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  )
}
