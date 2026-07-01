import { z } from './openapi'
import { FAILURE_KINDS, RUN_OUTCOMES, RUN_STATUSES, TRIGGER_SOURCES } from './run'

export { TRIGGER_SOURCES }

// A filter value arriving from the query string is either a CSV string
// ("running,completed") or, when set programmatically, an array. Both collapse
// to a validated array of the allowed enum members; unknown members drop out.
// The .transform() cannot be introspected for the contract, so each field
// carries an explicit override describing the input it accepts (zod-openapi).
const csvArray = <T extends string>(values: readonly T[]) =>
  z
    .union([z.string(), z.array(z.enum(values as [T, ...T[]]))])
    .transform((value) => {
      if (typeof value === 'string') {
        if (value === '') return [] as T[]
        const set = new Set<string>(values)
        return value.split(',').flatMap((raw): T[] => {
          const trimmed = raw.trim()
          return set.has(trimmed) ? [trimmed as T] : []
        })
      }
      return value
    })
    .meta({
      override: {
        anyOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string', enum: [...values] } },
        ],
      },
    })
    .catch([] as T[])
    .optional()

const csvSlugs = z
  .union([z.string(), z.array(z.string())])
  .transform((value): string[] => {
    if (typeof value === 'string') {
      return value.split(',').flatMap((raw) => {
        const trimmed = raw.trim()
        return trimmed ? [trimmed] : []
      })
    }
    return value
  })
  .meta({
    override: {
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    },
  })
  .catch([])
  .optional()

export const RunsSearchSchema = z
  .object({
    workspace: csvSlugs,
    status: csvArray(RUN_STATUSES),
    outcome: csvArray(RUN_OUTCOMES),
    failureKind: csvArray(FAILURE_KINDS),
    triggerSource: csvArray(TRIGGER_SOURCES),
    range: z
      .string()
      .regex(/^(all|\d+(m|h|d|w|mo))$/)
      .catch('24h')
      .default('24h'),
    cursor: z.string().catch('').optional(),
  })
  .meta({
    id: 'RunsSearchInput',
    description:
      'Filters for the cross-workspace runs list: workspace/status/outcome/trigger facets, a time range, and a cursor.',
  })

export type RunsFilters = z.infer<typeof RunsSearchSchema>
