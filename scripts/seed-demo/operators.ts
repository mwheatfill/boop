import type { InferInsertModel } from 'drizzle-orm'
import type { UserRole, users } from '@/lib/db/schema'
import { SEED_TAG } from './constants'
import { demoId } from './ids'

export type DemoOperatorSpec = {
  emailSlug: string
  email: string
  name: string
  role: UserRole
  joinedMonthsAgo: number
}

export const DEMO_OPERATORS: readonly DemoOperatorSpec[] = [
  {
    emailSlug: 'michael.wheatfill',
    email: 'michael.wheatfill@switchthink.com',
    name: 'Michael Wheatfill',
    role: 'admin',
    joinedMonthsAgo: 36,
  },
  {
    emailSlug: 'braden.chapman',
    email: 'braden.chapman@switchthink.com',
    name: 'Braden Chapman',
    role: 'admin',
    joinedMonthsAgo: 30,
  },
  {
    emailSlug: 'jason.smith',
    email: 'jason.smith@switchthink.com',
    name: 'Jason Smith',
    role: 'operator',
    joinedMonthsAgo: 24,
  },
  {
    emailSlug: 'dylan.mcneill',
    email: 'dylan.mcneill@switchthink.com',
    name: 'Dylan McNeill',
    role: 'operator',
    joinedMonthsAgo: 18,
  },
  {
    emailSlug: 'travis.wilbeck',
    email: 'travis.wilbeck@switchthink.com',
    name: 'Travis Wilbeck',
    role: 'operator',
    joinedMonthsAgo: 12,
  },
  {
    emailSlug: 'joleen.riley',
    email: 'joleen.riley@switchthink.com',
    name: 'Joleen Riley',
    role: 'operator',
    joinedMonthsAgo: 4,
  },
]

export type OperatorInsert = InferInsertModel<typeof users>

export function operatorRow(spec: DemoOperatorSpec, runStartedAt: Date): OperatorInsert {
  const createdAt = new Date(runStartedAt)
  createdAt.setMonth(createdAt.getMonth() - spec.joinedMonthsAgo)
  return {
    id: demoId('usr', spec.emailSlug),
    email: spec.email,
    name: spec.name,
    image: null,
    role: spec.role,
    seedTag: SEED_TAG,
    createdAt,
    updatedAt: createdAt,
  }
}
