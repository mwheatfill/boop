import { and, eq, isNull } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { jobTemplates } from '@/lib/db/schema'
import { FieldValidationError, isUniqueConstraintViolation } from '@/lib/errors'
import { normalizeSlug, resolveWorkspaceId } from '@/lib/workspaces/resolve'
import type {
  JobTemplate,
  JobTemplateCreateInput,
  JobTemplateSaveFromJobInput,
  JobTemplateUpdateInput,
} from '@/shared/schemas/job-template'
import { getJobDetail } from '../jobs/queries'
import { getTemplateById, getTemplateBySlug } from './queries'
import { STARTER_RECIPES } from './starter-recipes'

function uniqueTemplateMessage(builtIn: boolean, slug: string): string {
  return builtIn
    ? `Slug '${slug}' is already in use by another starter recipe`
    : `Slug '${slug}' is already in use by another template for this Workspace`
}

function starterRecipeValues(recipe: (typeof STARTER_RECIPES)[number]) {
  return {
    name: recipe.name,
    tag: recipe.tag,
    icon: recipe.icon ?? null,
    description: recipe.description ?? null,
    triggerKind: recipe.triggerKind,
    triggerConfig: recipe.triggerConfig,
    targetRef: recipe.targetRef,
    bodyTemplate: recipe.bodyTemplate,
    headersTemplate: recipe.headersTemplate,
    variables: recipe.variables ?? {},
    maxAttempts: recipe.maxAttempts ?? 3,
    overallDeadlineMs: recipe.overallDeadlineMs ?? 60_000,
  }
}

function triggerConfigForSavedJob(job: Awaited<ReturnType<typeof getJobDetail>>) {
  if (job.triggerKind === 'cron') {
    return {
      cronExpression: job.cronExpression ?? '0 9 * * *',
      triggerTimezone: job.triggerTimezone ?? job.workspaceTimezone,
    }
  }
  if (job.triggerKind === 'interval') {
    return { intervalSeconds: job.intervalSeconds ?? 300 }
  }
  return {}
}

export async function createJobTemplate(
  db: Database,
  input: JobTemplateCreateInput,
  options: { builtIn?: boolean } = {},
): Promise<JobTemplate> {
  const slug = normalizeSlug(input.slug)
  const id = newId('jtpl')
  const builtIn = options.builtIn ?? false
  let workspaceId: string | null = null
  if (!builtIn) {
    if (!input.workspaceSlug) {
      throw new FieldValidationError({ workspaceSlug: ['A Workspace is required'] })
    }
    workspaceId = await resolveWorkspaceId(db, input.workspaceSlug)
  }
  try {
    await db.insert(jobTemplates).values({
      id,
      name: input.name.trim(),
      slug,
      workspaceId,
      tag: input.tag,
      icon: input.icon ?? null,
      description: input.description ?? null,
      triggerKind: input.triggerKind,
      triggerConfig: input.triggerConfig,
      targetRef: input.targetRef,
      bodyTemplate: input.bodyTemplate,
      headersTemplate: input.headersTemplate,
      variables: input.variables,
      maxAttempts: input.maxAttempts,
      overallDeadlineMs: input.overallDeadlineMs,
      builtIn,
    })
  } catch (err) {
    if (isUniqueConstraintViolation(err, 'job_templates.slug')) {
      throw new FieldValidationError({ slug: [uniqueTemplateMessage(builtIn, slug)] })
    }
    throw err
  }
  return getTemplateBySlug(db, slug, builtIn ? undefined : input.workspaceSlug)
}

export async function updateJobTemplate(
  db: Database,
  id: string,
  input: JobTemplateUpdateInput,
): Promise<JobTemplate> {
  const current = await getTemplateById(db, id)
  if (current.builtIn) {
    throw new FieldValidationError({ template: ['Starter recipes are managed in code'] })
  }
  await db
    .update(jobTemplates)
    .set({
      name: input.name.trim(),
      tag: input.tag,
      icon: input.icon ?? null,
      description: input.description ?? null,
      triggerKind: input.triggerKind,
      triggerConfig: input.triggerConfig,
      targetRef: input.targetRef,
      bodyTemplate: input.bodyTemplate,
      headersTemplate: input.headersTemplate,
      variables: input.variables,
      maxAttempts: input.maxAttempts,
      overallDeadlineMs: input.overallDeadlineMs,
      updatedAt: new Date(),
    })
    .where(eq(jobTemplates.id, id))
  return getTemplateById(db, id)
}

export async function archiveJobTemplate(db: Database, id: string): Promise<JobTemplate> {
  const current = await getTemplateById(db, id)
  if (current.builtIn) {
    throw new FieldValidationError({ template: ['Starter recipes are managed in code'] })
  }
  const now = new Date()
  await db
    .update(jobTemplates)
    .set({ status: 'archived', archivedAt: now, updatedAt: now })
    .where(eq(jobTemplates.id, id))
  return getTemplateById(db, id)
}

export async function restoreJobTemplate(db: Database, id: string): Promise<JobTemplate> {
  const now = new Date()
  await db
    .update(jobTemplates)
    .set({ status: 'active', archivedAt: null, updatedAt: now })
    .where(eq(jobTemplates.id, id))
  return getTemplateById(db, id)
}

export async function saveJobAsTemplate(
  db: Database,
  input: JobTemplateSaveFromJobInput,
): Promise<JobTemplate> {
  const job = await getJobDetail(db, input.workspaceSlug, input.jobSlug)
  return createJobTemplate(db, {
    name: input.name,
    slug: input.slug,
    workspaceSlug: input.workspaceSlug,
    tag: input.tag,
    description: input.description,
    icon: 'copy-plus',
    triggerKind: job.triggerKind,
    triggerConfig: triggerConfigForSavedJob(job),
    targetRef: job.targetSlug,
    bodyTemplate: input.capture.bodyTemplate ? job.bodyTemplate : '',
    headersTemplate: input.capture.headersTemplate ? job.headersTemplate : '{}',
    variables: input.capture.variables ? job.variables : {},
    maxAttempts: input.capture.maxAttempts ? job.maxAttempts : 3,
    overallDeadlineMs: input.capture.overallDeadlineMs ? job.overallDeadlineMs : 60_000,
  })
}

export async function seedStarterRecipes(db: Database): Promise<number> {
  let changed = 0
  for (const recipe of STARTER_RECIPES) {
    const values = starterRecipeValues(recipe)
    const existing = (
      await db
        .select({ id: jobTemplates.id })
        .from(jobTemplates)
        .where(
          and(
            isNull(jobTemplates.workspaceId),
            eq(jobTemplates.slug, recipe.slug),
            eq(jobTemplates.builtIn, true),
          ),
        )
        .limit(1)
    )[0]
    if (existing) {
      await db
        .update(jobTemplates)
        .set({
          ...values,
          status: 'active',
          archivedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(jobTemplates.id, existing.id))
      changed += 1
    } else {
      await createJobTemplate(
        db,
        {
          ...recipe,
          variables: values.variables,
          maxAttempts: values.maxAttempts,
          overallDeadlineMs: values.overallDeadlineMs,
        },
        { builtIn: true },
      )
      changed += 1
    }
  }
  return changed
}
