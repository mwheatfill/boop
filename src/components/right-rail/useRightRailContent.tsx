import { useMatches } from '@tanstack/react-router'
import { type ReactNode, useMemo } from 'react'
import { CustomerPropertiesPanel } from './CustomerPropertiesPanel'
import { JobPropertiesPanel } from './JobPropertiesPanel'
import { RunPropertiesPanel } from './RunPropertiesPanel'
import { TargetPropertiesPanel } from './TargetPropertiesPanel'

export const RIGHT_RAIL_ROUTE_IDS = {
  customer: '/_authenticated/customers/$customerSlug/',
  job: '/_authenticated/customers/$customerSlug/jobs/$jobSlug/',
  run: '/_authenticated/customers/$customerSlug/jobs/$jobSlug/runs/$runId',
  target: '/_authenticated/_admin/customers/$customerSlug/targets/$targetSlug',
} as const

export type RightRailRouteId = (typeof RIGHT_RAIL_ROUTE_IDS)[keyof typeof RIGHT_RAIL_ROUTE_IDS]

export interface RightRailContent {
  routeId: RightRailRouteId
  title: string
  body: ReactNode
}

const TITLES: Record<RightRailRouteId, string> = {
  [RIGHT_RAIL_ROUTE_IDS.customer]: 'Customer properties',
  [RIGHT_RAIL_ROUTE_IDS.job]: 'Job properties',
  [RIGHT_RAIL_ROUTE_IDS.run]: 'Run properties',
  [RIGHT_RAIL_ROUTE_IDS.target]: 'Target properties',
}

interface RailSelection {
  routeId: RightRailRouteId
  params: Record<string, string>
}

function selectLeaf(
  matches: ReadonlyArray<{ id: string; params: Record<string, unknown> }>,
): RailSelection | null {
  const leaf = matches[matches.length - 1]
  if (!leaf) return null
  const routeId = (Object.values(RIGHT_RAIL_ROUTE_IDS) as string[]).find((id) => id === leaf.id) as
    | RightRailRouteId
    | undefined
  if (!routeId) return null
  const params: Record<string, string> = {}
  for (const [k, v] of Object.entries(leaf.params)) {
    if (typeof v === 'string') params[k] = v
  }
  return { routeId, params }
}

function renderBody({ routeId, params }: RailSelection): ReactNode {
  switch (routeId) {
    case RIGHT_RAIL_ROUTE_IDS.run:
      return params.customerSlug && params.jobSlug && params.runId ? (
        <RunPropertiesPanel
          customerSlug={params.customerSlug}
          jobSlug={params.jobSlug}
          runId={params.runId}
        />
      ) : null
    case RIGHT_RAIL_ROUTE_IDS.job:
      return params.customerSlug && params.jobSlug ? (
        <JobPropertiesPanel customerSlug={params.customerSlug} jobSlug={params.jobSlug} />
      ) : null
    case RIGHT_RAIL_ROUTE_IDS.target:
      return params.customerSlug && params.targetSlug ? (
        <TargetPropertiesPanel customerSlug={params.customerSlug} targetSlug={params.targetSlug} />
      ) : null
    case RIGHT_RAIL_ROUTE_IDS.customer:
      return params.customerSlug ? (
        <CustomerPropertiesPanel customerSlug={params.customerSlug} />
      ) : null
  }
}

export function useRightRailContent(): RightRailContent | null {
  const selection = useMatches({ select: (m) => selectLeaf(m as never) })
  return useMemo<RightRailContent | null>(() => {
    if (!selection) return null
    const body = renderBody(selection)
    if (!body) return null
    return { routeId: selection.routeId, title: TITLES[selection.routeId], body }
  }, [selection])
}
