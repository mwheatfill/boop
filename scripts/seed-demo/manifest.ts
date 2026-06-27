export type Profile = 'demo' | 'stress' | 'minimal'

export type ProfileConfig = {
  historyDays: number
  workspaceSlugs: 'all' | readonly string[]
  jobSlugs: 'all' | readonly string[]
}

const ALL_OF: 'all' = 'all'

export const PROFILES: Record<Profile, ProfileConfig> = {
  demo: {
    historyDays: 14,
    workspaceSlugs: ['desert-vista-cu'],
    jobSlugs: ALL_OF,
  },
  stress: {
    historyDays: 90,
    workspaceSlugs: ALL_OF,
    jobSlugs: ALL_OF,
  },
  minimal: {
    historyDays: 3,
    workspaceSlugs: ['desert-vista-cu'],
    jobSlugs: [
      'core-banking-probe',
      'ach-transactions-ingest',
      'card-settlements-reconcile',
      'daily-balances-report',
      'warm-account-cache',
    ],
  },
}

export function isProfile(value: string): value is Profile {
  return value === 'demo' || value === 'stress' || value === 'minimal'
}
