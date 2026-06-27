export const PICKER_KEYS = {
  lastWorkspace: 'boop.last-workspace:v1',
  lastTarget: (workspaceSlug: string) =>
    workspaceSlug ? `boop.last-target.${workspaceSlug}:v1` : 'boop.last-target.__none:v1',
  lastTimezone: 'boop.last-timezone:v1',
  recentWorkspaces: 'boop.recents.workspaces:v1',
  recentTargets: (workspaceSlug: string) =>
    workspaceSlug ? `boop.recents.targets.${workspaceSlug}:v1` : 'boop.recents.targets.__none:v1',
  recentChannels: (workspaceSlug: string) =>
    workspaceSlug ? `boop.recents.channels.${workspaceSlug}:v1` : 'boop.recents.channels.__none:v1',
  recentTimezones: 'boop.recents.timezones:v1',
} as const

export const PICKER_RECENT_LIMITS = {
  workspaces: 5,
  targets: 3,
  channels: 5,
  timezones: 5,
} as const
