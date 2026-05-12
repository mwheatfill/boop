import { useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { CustomerPropertiesPanel } from './CustomerPropertiesPanel'
import { JobPropertiesPanel } from './JobPropertiesPanel'
import { RunPropertiesPanel } from './RunPropertiesPanel'
import { TargetPropertiesPanel } from './TargetPropertiesPanel'

export interface RightRailContent {
  /** Stable id per route shape; used as the localStorage suffix for per-route preference. */
  routeId: string
  title: string
  body: ReactNode
}

/**
 * Map the current pathname to a properties panel.
 *
 * PRD #44 names four route shapes that auto-open the rail: Job detail,
 * Run detail, Customer hub, Target detail. Channel / AlertRule mappings
 * are PRD #25's concern and live there, not here.
 */
export function useRightRailContent(): RightRailContent | null {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // Run detail: /customers/$customerSlug/jobs/$jobSlug/runs/$runId
  const runMatch = pathname.match(/^\/customers\/([^/]+)\/jobs\/([^/]+)\/runs\/([^/]+)$/)
  if (runMatch) {
    const [, customerSlug, jobSlug, runId] = runMatch
    if (customerSlug && jobSlug && runId) {
      return {
        routeId: 'run-detail',
        title: 'Run properties',
        body: <RunPropertiesPanel customerSlug={customerSlug} jobSlug={jobSlug} runId={runId} />,
      }
    }
  }

  // Job detail: /customers/$customerSlug/jobs/$jobSlug
  const jobMatch = pathname.match(/^\/customers\/([^/]+)\/jobs\/([^/]+)$/)
  if (jobMatch) {
    const [, customerSlug, jobSlug] = jobMatch
    if (customerSlug && jobSlug) {
      return {
        routeId: 'job-detail',
        title: 'Job properties',
        body: <JobPropertiesPanel customerSlug={customerSlug} jobSlug={jobSlug} />,
      }
    }
  }

  // Target detail: /customers/$customerSlug/targets/$targetSlug
  const targetMatch = pathname.match(/^\/customers\/([^/]+)\/targets\/([^/]+)$/)
  if (targetMatch) {
    const [, customerSlug, targetSlug] = targetMatch
    if (customerSlug && targetSlug) {
      return {
        routeId: 'target-detail',
        title: 'Target properties',
        body: <TargetPropertiesPanel customerSlug={customerSlug} targetSlug={targetSlug} />,
      }
    }
  }

  // Customer hub: /customers/$customerSlug
  const customerMatch = pathname.match(/^\/customers\/([^/]+)$/)
  if (customerMatch?.[1] && customerMatch[1] !== 'new') {
    return {
      routeId: 'customer-detail',
      title: 'Customer properties',
      body: <CustomerPropertiesPanel customerSlug={customerMatch[1]} />,
    }
  }

  return null
}
