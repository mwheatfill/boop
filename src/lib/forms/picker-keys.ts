export const PICKER_KEYS = {
  lastCustomer: 'boop.last-customer',
  lastTarget: (customerSlug: string) =>
    customerSlug ? `boop.last-target.${customerSlug}` : 'boop.last-target.__none',
  lastTimezone: 'boop.last-timezone',
  recentCustomers: 'boop.recents.customers',
  recentTargets: (customerSlug: string) =>
    customerSlug ? `boop.recents.targets.${customerSlug}` : 'boop.recents.targets.__none',
  recentChannels: (customerSlug: string) =>
    customerSlug ? `boop.recents.channels.${customerSlug}` : 'boop.recents.channels.__none',
  recentTimezones: 'boop.recents.timezones',
} as const

export const PICKER_RECENT_LIMITS = {
  customers: 5,
  targets: 3,
  channels: 5,
  timezones: 5,
} as const
