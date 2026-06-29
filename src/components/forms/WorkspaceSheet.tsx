import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { toast } from 'sonner'
import { Section } from '@/components/Section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { fieldErrorsToTanstack, type MutationResult } from '@/lib/mutation-result'
import { slugify } from '@/lib/slug/slugify'
import { orgTimezoneQueryOptions } from '@/lib/workspaces/query-options'
import { createWorkspaceFn, updateWorkspaceFn } from '@/lib/workspaces/server-fns'
import type { Workspace } from '@/shared/schemas/workspace'
import {
  KeyValueListEditor,
  type KeyValueRow,
  rowsToVariableMap,
  variableMapToRows,
} from './KeyValueListEditor'
import { TimezoneCombobox } from './TimezoneCombobox'
import { useSlugAutoFill } from './use-slug-auto-fill'
import { WorkspaceSecretsPanel } from './WorkspaceSecretsPanel'

const FALLBACK_TIMEZONE = 'America/Phoenix'

interface WorkspaceFormValues {
  name: string
  slug: string
  timezone: string
  autotaskCompanyId: string
  variables: KeyValueRow[]
}

function initialValues(
  workspace: Workspace | undefined,
  initialName: string | undefined,
  orgTimezone: string,
): WorkspaceFormValues {
  if (workspace) {
    return {
      name: workspace.name,
      slug: workspace.slug,
      timezone: workspace.timezone,
      autotaskCompanyId: workspace.autotaskCompanyId ?? '',
      variables: variableMapToRows(workspace.variables),
    }
  }
  return {
    name: initialName ?? '',
    slug: initialName ? slugify(initialName) : '',
    timezone: orgTimezone,
    autotaskCompanyId: '',
    variables: [],
  }
}

export interface WorkspaceSheetProps {
  workspace?: Workspace
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Seed the name (and derived slug) when opening a fresh create. Used by nested-create flows. */
  initialName?: string
  /** Nested create: when set, the created Workspace is returned here instead of toasting. */
  onCreated?: (workspace: Workspace) => void | Promise<void>
}

export function WorkspaceSheet({
  workspace,
  trigger,
  open: openProp,
  onOpenChange,
  initialName,
  onCreated,
}: WorkspaceSheetProps) {
  const isEdit = !!workspace
  const queryClient = useQueryClient()
  const slug = useSlugAutoFill(isEdit)
  const orgTimezoneQuery = useQuery(orgTimezoneQueryOptions)
  const orgTimezone = orgTimezoneQuery.data?.timezone ?? FALLBACK_TIMEZONE
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const form = useAppForm({
    defaultValues: initialValues(workspace, initialName, orgTimezone),
    validators: {
      onSubmitAsync: async ({ value }) => {
        const result: MutationResult<Workspace> = isEdit
          ? await updateWorkspaceFn({
              data: {
                slug: workspace.slug,
                name: value.name,
                timezone: value.timezone,
                ...(value.autotaskCompanyId ? { autotaskCompanyId: value.autotaskCompanyId } : {}),
                variables: rowsToVariableMap(value.variables),
              } as never,
            })
          : await createWorkspaceFn({
              data: {
                name: value.name,
                slug: value.slug,
                timezone: value.timezone,
                ...(value.autotaskCompanyId ? { autotaskCompanyId: value.autotaskCompanyId } : {}),
              } as never,
            })
        if (!result.ok) {
          return {
            ...(result.message ? { form: result.message } : {}),
            fields: fieldErrorsToTanstack(result.fieldErrors),
          }
        }
        await queryClient.invalidateQueries({ queryKey: ['workspaces'] })
        setOpen(false)
        if (!isEdit && onCreated) {
          await onCreated(result.data)
        } else {
          toast.success(isEdit ? 'Saved' : `Workspace ${result.data.name} created`)
        }
        return null
      },
    },
  })

  function handleOpenChange(next: boolean) {
    if (next) {
      if (isEdit) slug.markManual()
      else slug.reset()
      form.reset(initialValues(workspace, initialName, orgTimezone))
    }
    setOpen(next)
  }

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
              <Building2 className="size-5" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <SheetTitle className="truncate text-base">
                {isEdit ? workspace.name : 'New Workspace'}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {isEdit
                  ? 'Settings, variables, and secrets'
                  : 'A space that owns Targets, Jobs, and Channels'}
              </SheetDescription>
            </div>
            {isEdit ? (
              <Badge variant="secondary" className="shrink-0">
                {workspace.status}
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
                {(f) => <f.TextField label="Name" placeholder="Acme" autoFocus />}
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
                      placeholder="acme"
                      className="h-9 rounded-md border border-input bg-transparent px-3 font-mono text-xs shadow-xs read-only:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:bg-input/30"
                    />
                    <FieldDescription>
                      {isEdit ? "Slug can't change after creation." : 'Used in URLs and the API.'}
                    </FieldDescription>
                  </Field>
                )}
              </form.AppField>
            </Section>

            <Section title="Settings">
              <Field>
                <form.Subscribe selector={(s) => s.values.timezone}>
                  {(timezone) => (
                    <TimezoneCombobox
                      value={timezone}
                      onValueChange={(v) => form.setFieldValue('timezone', v)}
                      required
                    />
                  )}
                </form.Subscribe>
                <FieldDescription>
                  The Workspace's local timezone for cron schedules and report rendering.
                </FieldDescription>
              </Field>
              <form.AppField name="autotaskCompanyId">
                {(f) => <f.TextField label="Autotask company id" description="Optional." />}
              </form.AppField>
            </Section>

            {isEdit ? (
              <>
                <Section
                  title="Variables"
                  hint="Available to every Job for this Workspace as {{ variable_name }}. Jobs may override by name."
                >
                  <form.AppField name="variables">
                    {(f) => (
                      <KeyValueListEditor
                        rows={f.state.value}
                        onChange={(rows) => f.handleChange(rows)}
                      />
                    )}
                  </form.AppField>
                </Section>

                <Section
                  title="Secrets"
                  hint={
                    <>
                      Encrypted at rest, referenced from templates with{' '}
                      <code className="font-mono">{'{% boop_secret "name" %}'}</code>. boop redacts
                      the value in preview and shows the plaintext only at create + rotate.
                    </>
                  }
                >
                  <WorkspaceSecretsPanel workspaceSlug={workspace.slug} canEdit />
                </Section>
              </>
            ) : null}

            <form.Subscribe selector={(s) => s.errorMap.onSubmit}>
              {(formError) => (formError ? <FieldError>{String(formError)}</FieldError> : null)}
            </form.Subscribe>
          </div>

          <SheetFooter className="flex-row items-center justify-end gap-2 border-t p-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <form.AppForm>
              <form.SubmitButton>{isEdit ? 'Save changes' : 'Create Workspace'}</form.SubmitButton>
            </form.AppForm>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
