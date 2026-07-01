import { useForm, useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { EntityModal } from '@/components/forms/EntityModal'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { jobTemplateKeys } from '@/lib/job-templates/query-options'
import { saveJobAsTemplateFn } from '@/lib/job-templates/server-fns'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import type { Job } from '@/shared/schemas/job'
import type { JobTemplate, JobTemplateTag } from '@/shared/schemas/job-template'

interface SaveJobTemplateModalProps {
  job: Job
  onClose: () => void
}

const TAGS: Array<{ value: JobTemplateTag; label: string }> = [
  { value: 'backups', label: 'Backups' },
  { value: 'health-checks', label: 'Health checks' },
  { value: 'reports', label: 'Reports' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'custom', label: 'Custom' },
]

const CAPTURE_FIELDS = [
  { name: 'bodyTemplate', label: 'Body' },
  { name: 'headersTemplate', label: 'Headers' },
  { name: 'variables', label: 'Variables' },
  { name: 'maxAttempts', label: 'Retry count' },
  { name: 'overallDeadlineMs', label: 'Deadline' },
] as const

export function SaveJobTemplateModal({ job, onClose }: SaveJobTemplateModalProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const form = useForm({
    defaultValues: {
      name: `${job.name} template`,
      slug: slugify(`${job.name} template`),
      tag: 'custom' as JobTemplateTag,
      description: '',
      bodyTemplate: true,
      headersTemplate: true,
      variables: true,
      maxAttempts: true,
      overallDeadlineMs: true,
    },
    validators: {
      onSubmitAsync: async ({ value }) => {
        const result: MutationResult<JobTemplate> = await saveJobAsTemplateFn({
          data: {
            workspaceSlug: job.workspaceSlug,
            jobSlug: job.slug,
            name: value.name,
            slug: value.slug,
            tag: value.tag,
            ...(value.description ? { description: value.description } : {}),
            capture: {
              bodyTemplate: value.bodyTemplate,
              headersTemplate: value.headersTemplate,
              variables: value.variables,
              maxAttempts: value.maxAttempts,
              overallDeadlineMs: value.overallDeadlineMs,
            },
          },
        })
        if (!result.ok) {
          return {
            ...(result.message ? { form: result.message } : {}),
            fields: fieldErrorsToTanstack(result.fieldErrors),
          }
        }
        await queryClient.invalidateQueries({ queryKey: jobTemplateKeys.all() })
        toast.success('Template saved')
        onClose()
        await navigate({ to: '/templates' })
        return null
      },
    },
  })
  const isDirty = useStore(form.store, (s) => s.isDirty)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)
  const formError = useStore(form.store, (s) => s.errorMap.onSubmit)

  return (
    <EntityModal
      open
      onClose={onClose}
      title="Save as template"
      dirty={isDirty && !isSubmitting}
      primaryAction={{
        label: 'Save template',
        onClick: () => void form.handleSubmit(),
        loading: isSubmitting,
      }}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field
          name="name"
          listeners={{
            onChange: ({ value }) => form.setFieldValue('slug', slugify(value)),
          }}
        >
          {(field) => (
            <div className="flex flex-col gap-1">
              <Input
                value={field.state.value}
                onChange={(event) => field.handleChange(event.currentTarget.value)}
                placeholder="Template name"
              />
              <form.Field name="slug">
                {(slugField) => (
                  <input
                    value={slugField.state.value}
                    onChange={(event) => slugField.handleChange(event.currentTarget.value)}
                    aria-label="Slug"
                    className="border-0 bg-transparent px-0 font-mono text-xs text-muted-foreground focus:outline-none"
                  />
                )}
              </form.Field>
            </div>
          )}
        </form.Field>

        <form.Field name="tag">
          {(field) => (
            <Select
              value={field.state.value}
              onValueChange={(value) => field.handleChange(value as JobTemplateTag)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAGS.map((tag) => (
                  <SelectItem key={tag.value} value={tag.value}>
                    {tag.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => (
            <Input
              value={field.state.value}
              onChange={(event) => field.handleChange(event.currentTarget.value)}
              placeholder="Short card description"
            />
          )}
        </form.Field>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {CAPTURE_FIELDS.map((item) => (
            <form.Field key={item.name} name={item.name}>
              {(field) => (
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(field.state.value)}
                    onChange={(event) => field.handleChange(event.currentTarget.checked)}
                  />
                  {item.label}
                </label>
              )}
            </form.Field>
          ))}
        </div>

        {formError ? <p className="text-sm text-destructive">{String(formError)}</p> : null}
      </form>
    </EntityModal>
  )
}
