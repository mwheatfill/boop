import { useForm, useStore } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { EntityModal } from '@/components/forms/EntityModal'
import {
  KeyValueListEditor,
  type KeyValueRow,
  rowsToVariableMap,
  variableMapToRows,
} from '@/components/forms/KeyValueListEditor'
import { TimezoneCombobox } from '@/components/forms/TimezoneCombobox'
import { useSlugAutoFill } from '@/components/forms/use-slug-auto-fill'
import { WorkspaceSecretsPanel } from '@/components/forms/WorkspaceSecretsPanel'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import { orgTimezoneQueryOptions } from '@/lib/workspaces/query-options'
import { createWorkspaceFn, updateWorkspaceFn } from '@/lib/workspaces/server-fns'
import type { Workspace } from '@/shared/schemas/workspace'

interface WorkspaceFormValues {
  name: string
  slug: string
  timezone: string
  autotaskCompanyId: string
  variables: KeyValueRow[]
}

interface CreateProps {
  variant: 'create'
  initialName?: string
  onClose: () => void
  onCreated?: (workspace: Workspace) => void | Promise<void>
}

interface EditProps {
  variant: 'edit'
  initialWorkspace: Workspace
  onClose: () => void
}

type WorkspaceModalProps = CreateProps | EditProps

const FALLBACK_TIMEZONE = 'America/Phoenix'

export function WorkspaceModal(props: WorkspaceModalProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const slug = useSlugAutoFill(props.variant === 'edit')
  const orgTimezoneQuery = useQuery(orgTimezoneQueryOptions)
  const orgTimezone = orgTimezoneQuery.data?.timezone ?? FALLBACK_TIMEZONE

  const initial: WorkspaceFormValues =
    props.variant === 'edit'
      ? {
          name: props.initialWorkspace.name,
          slug: props.initialWorkspace.slug,
          timezone: props.initialWorkspace.timezone,
          autotaskCompanyId: props.initialWorkspace.autotaskCompanyId ?? '',
          variables: variableMapToRows(props.initialWorkspace.variables),
        }
      : {
          name: props.initialName ?? '',
          slug: props.initialName ? slugify(props.initialName) : '',
          timezone: orgTimezone,
          autotaskCompanyId: '',
          variables: [],
        }

  const form = useForm({
    defaultValues: initial,
    validators: {
      onSubmitAsync: async ({ value }) => {
        const payload =
          props.variant === 'create'
            ? {
                name: value.name,
                slug: value.slug,
                timezone: value.timezone,
                ...(value.autotaskCompanyId ? { autotaskCompanyId: value.autotaskCompanyId } : {}),
              }
            : {
                slug: props.initialWorkspace.slug,
                name: value.name,
                timezone: value.timezone,
                ...(value.autotaskCompanyId ? { autotaskCompanyId: value.autotaskCompanyId } : {}),
                variables: rowsToVariableMap(value.variables),
              }

        const result: MutationResult<Workspace> =
          props.variant === 'create'
            ? await createWorkspaceFn({ data: payload as never })
            : await updateWorkspaceFn({ data: payload as never })

        if (!result.ok) {
          return {
            ...(result.message ? { form: result.message } : {}),
            fields: fieldErrorsToTanstack(result.fieldErrors),
          }
        }

        await queryClient.invalidateQueries({ queryKey: ['workspaces'] })

        if (props.variant === 'create' && props.onCreated) {
          await props.onCreated(result.data)
          return null
        }

        toast.success(
          props.variant === 'create' ? `Workspace ${result.data.name} created` : 'Saved',
        )
        await navigate({ to: '/' })
        return null
      },
    },
  })

  const isDirty = useStore(form.store, (s) => s.isDirty)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)
  const timezone = useStore(form.store, (s) => s.values.timezone)
  const formError = useStore(form.store, (s) => s.errorMap.onSubmit)

  return (
    <EntityModal
      open
      onClose={props.onClose}
      title={props.variant === 'create' ? 'New Workspace' : `Edit ${props.initialWorkspace.name}`}
      dirty={isDirty && !isSubmitting}
      primaryAction={{
        label: props.variant === 'create' ? 'Create Workspace' : 'Save changes',
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
                placeholder="Name this Workspace…"
                onChange={(e) => field.handleChange(e.currentTarget.value)}
                className="h-auto border-0 bg-transparent px-0 text-xl font-medium tracking-tight shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
              />
              <form.Field name="slug">
                {(slugField) => (
                  <input
                    type="text"
                    value={slugField.state.value}
                    readOnly={props.variant === 'edit'}
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
              {props.variant === 'edit' ? (
                <p className="text-xs text-muted-foreground/70">
                  Slug can't change after creation.
                </p>
              ) : null}
            </div>
          )}
        </form.Field>

        <div className="flex flex-col gap-2">
          <Label className="text-xs font-medium text-muted-foreground">Timezone</Label>
          <TimezoneCombobox
            value={timezone}
            onValueChange={(v) => form.setFieldValue('timezone', v)}
            required
          />
          <p className="text-xs text-muted-foreground/70">
            The Workspace's local timezone for cron schedules and report rendering.
          </p>
        </div>

        <form.Field name="autotaskCompanyId">
          {(field) => (
            <div className="flex flex-col gap-2">
              <label htmlFor={field.name} className="text-xs font-medium text-muted-foreground">
                Autotask company id (optional)
              </label>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.currentTarget.value)}
              />
            </div>
          )}
        </form.Field>

        {props.variant === 'edit' ? (
          <>
            <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
              <Label className="text-xs font-medium text-muted-foreground">Variables</Label>
              <p className="text-xs text-muted-foreground/70">
                Available to every Job for this Workspace as {'{{ variable_name }}'}. Jobs may
                override by name.
              </p>
              <form.Field name="variables">
                {(field) => (
                  <KeyValueListEditor
                    rows={field.state.value}
                    onChange={(rows) => field.handleChange(rows)}
                  />
                )}
              </form.Field>
            </section>

            <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
              <Label className="text-xs font-medium text-muted-foreground">Secrets</Label>
              <p className="text-xs text-muted-foreground/70">
                Encrypted at rest, referenced from templates with{' '}
                <code className="font-mono">{'{% boop_secret "name" %}'}</code>. boop redacts the
                value in preview and shows the plaintext only at create + rotate.
              </p>
              <WorkspaceSecretsPanel workspaceSlug={props.initialWorkspace.slug} canEdit />
            </section>
          </>
        ) : null}

        {formError ? <p className="text-sm text-destructive">{String(formError)}</p> : null}
      </form>
    </EntityModal>
  )
}
