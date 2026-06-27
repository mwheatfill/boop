import type { InferInsertModel } from 'drizzle-orm'
import type { workspaces } from '@/lib/db/schema'
import { SEED_TAG } from './constants'
import { demoId } from './ids'

export type DemoWorkspaceSpec = {
  slug: string
  name: string
  timezone: string
  industry: string
  autotaskCompanyId: string | null
  createdMonthsAgo: number
}

export const DEMO_WORKSPACES: readonly DemoWorkspaceSpec[] = [
  {
    slug: 'desert-vista-cu',
    name: 'Desert Vista Credit Union',
    timezone: 'America/Phoenix',
    industry: 'financial',
    autotaskCompanyId: '10001',
    createdMonthsAgo: 34,
  },
  {
    slug: 'cactus-title',
    name: 'Cactus Title',
    timezone: 'America/Phoenix',
    industry: 'real_estate',
    autotaskCompanyId: '10002',
    createdMonthsAgo: 28,
  },
  {
    slug: 'sun-valley-insurance',
    name: 'Sun Valley Insurance',
    timezone: 'America/Phoenix',
    industry: 'insurance',
    autotaskCompanyId: '10003',
    createdMonthsAgo: 22,
  },
  {
    slug: 'phoenix-healthcare-partners',
    name: 'Phoenix Healthcare Partners',
    timezone: 'America/Phoenix',
    industry: 'healthcare',
    autotaskCompanyId: '10004',
    createdMonthsAgo: 19,
  },
  {
    slug: 'mesa-manufacturing',
    name: 'Mesa Manufacturing Co.',
    timezone: 'America/Phoenix',
    industry: 'manufacturing',
    autotaskCompanyId: '10005',
    createdMonthsAgo: 14,
  },
  {
    slug: 'salt-river-logistics',
    name: 'Salt River Logistics',
    timezone: 'America/Los_Angeles',
    industry: 'logistics',
    autotaskCompanyId: '10006',
    createdMonthsAgo: 11,
  },
  {
    slug: 'tempe-tech-group',
    name: 'Tempe Tech Group',
    timezone: 'America/Phoenix',
    industry: 'technology',
    autotaskCompanyId: '10007',
    createdMonthsAgo: 8,
  },
  {
    slug: 'skyline-realty-trust',
    name: 'Skyline Realty Trust',
    timezone: 'America/Phoenix',
    industry: 'real_estate',
    autotaskCompanyId: '10008',
    createdMonthsAgo: 5,
  },
  {
    slug: 'switchthink',
    name: 'SwitchThink',
    timezone: 'America/Phoenix',
    industry: 'internal',
    autotaskCompanyId: null,
    createdMonthsAgo: 36,
  },
]

export type WorkspaceInsert = InferInsertModel<typeof workspaces>

export function workspaceRow(spec: DemoWorkspaceSpec, runStartedAt: Date): WorkspaceInsert {
  const createdAt = new Date(runStartedAt)
  createdAt.setMonth(createdAt.getMonth() - spec.createdMonthsAgo)
  return {
    id: demoId('cust', spec.slug),
    name: spec.name,
    slug: spec.slug,
    timezone: spec.timezone,
    autotaskCompanyId: spec.autotaskCompanyId,
    status: 'active',
    seedTag: SEED_TAG,
    createdAt,
    updatedAt: createdAt,
  }
}
