export const PICKER_KEYS = {
  lastCustomer: 'boop.last-customer:v1',
  lastTarget: (customerSlug: string) =>
    customerSlug ? `boop.last-target.${customerSlug}:v1` : 'boop.last-target.__none:v1',
  lastTimezone: 'boop.last-timezone:v1',
  recentCustomers: 'boop.recents.customers:v1',
  recentTargets: (customerSlug: string) =>
    customerSlug ? `boop.recents.targets.${customerSlug}:v1` : 'boop.recents.targets.__none:v1',
  recentChannels: (customerSlug: string) =>
    customerSlug ? `boop.recents.channels.${customerSlug}:v1` : 'boop.recents.channels.__none:v1',
  recentTimezones: 'boop.recents.timezones:v1',
} as const

export const PICKER_RECENT_LIMITS = {
  customers: 5,
  targets: 3,
  channels: 5,
  timezones: 5,
} as const
