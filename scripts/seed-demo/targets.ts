import type { InferInsertModel } from 'drizzle-orm'
import type { targets } from '@/lib/db/schema'
import { demoId } from './ids'

type Reachability = 'public' | 'tunnel'
type AuthKind = 'none' | 'bearer' | 'basic' | 'header'
type HttpMethod = 'GET' | 'POST' | 'PUT'

export type DemoTargetSpec = {
  customerSlug: string
  slug: string
  name: string
  url: string
  method: HttpMethod
  authKind: AuthKind
  reachability: Reachability
}

export const DEMO_TARGETS: readonly DemoTargetSpec[] = [
  // Desert Vista Credit Union (heaviest user) — 4 targets
  {
    customerSlug: 'desert-vista-cu',
    slug: 'core-banking',
    name: 'Core Banking API',
    url: 'https://api.desertvistacu.internal/core-banking',
    method: 'POST',
    authKind: 'bearer',
    reachability: 'tunnel',
  },
  {
    customerSlug: 'desert-vista-cu',
    slug: 'fedline',
    name: 'FedLine Gateway',
    url: 'https://fedline-gateway.desertvistacu.internal/v2',
    method: 'POST',
    authKind: 'header',
    reachability: 'tunnel',
  },
  {
    customerSlug: 'desert-vista-cu',
    slug: 'card-processor',
    name: 'Card Processor Webhook',
    url: 'https://hooks.cardproc.example/desert-vista',
    method: 'POST',
    authKind: 'header',
    reachability: 'public',
  },
  {
    customerSlug: 'desert-vista-cu',
    slug: 'health-probe',
    name: 'Health Probe',
    url: 'https://api.desertvistacu.internal/health',
    method: 'GET',
    authKind: 'none',
    reachability: 'tunnel',
  },

  // Cactus Title — 3 targets
  {
    customerSlug: 'cactus-title',
    slug: 'docusign',
    name: 'DocuSign Connect',
    url: 'https://account-d.docusign.com/restapi/v2.1/accounts/cactus-title',
    method: 'POST',
    authKind: 'bearer',
    reachability: 'public',
  },
  {
    customerSlug: 'cactus-title',
    slug: 'title-system',
    name: 'Title System Sync',
    url: 'https://titles.cactustitle.example/api/sync',
    method: 'POST',
    authKind: 'basic',
    reachability: 'public',
  },
  {
    customerSlug: 'cactus-title',
    slug: 'health-probe',
    name: 'Health Probe',
    url: 'https://titles.cactustitle.example/health',
    method: 'GET',
    authKind: 'none',
    reachability: 'public',
  },

  // Sun Valley Insurance — 3 targets
  {
    customerSlug: 'sun-valley-insurance',
    slug: 'policy-api',
    name: 'Policy Management API',
    url: 'https://policies.sunvalleyins.example/v2',
    method: 'POST',
    authKind: 'bearer',
    reachability: 'public',
  },
  {
    customerSlug: 'sun-valley-insurance',
    slug: 'carrier-sync',
    name: 'Carrier Sync Hub',
    url: 'https://carriers.sunvalleyins.internal/sync',
    method: 'PUT',
    authKind: 'header',
    reachability: 'tunnel',
  },
  {
    customerSlug: 'sun-valley-insurance',
    slug: 'webhook-claims',
    name: 'Claims Webhook',
    url: 'https://policies.sunvalleyins.example/v2/webhooks/claims',
    method: 'POST',
    authKind: 'header',
    reachability: 'public',
  },

  // Phoenix Healthcare Partners — 3 targets
  {
    customerSlug: 'phoenix-healthcare-partners',
    slug: 'ehr-bridge',
    name: 'EHR Bridge',
    url: 'https://ehr.phoenixhealthcare.internal/bridge',
    method: 'POST',
    authKind: 'bearer',
    reachability: 'tunnel',
  },
  {
    customerSlug: 'phoenix-healthcare-partners',
    slug: 'patient-portal',
    name: 'Patient Portal API',
    url: 'https://api.phoenixhealthcare.example/portal',
    method: 'GET',
    authKind: 'bearer',
    reachability: 'public',
  },
  {
    customerSlug: 'phoenix-healthcare-partners',
    slug: 'health-probe',
    name: 'Health Probe',
    url: 'https://api.phoenixhealthcare.example/health',
    method: 'GET',
    authKind: 'none',
    reachability: 'public',
  },

  // Mesa Manufacturing Co. — 2 targets
  {
    customerSlug: 'mesa-manufacturing',
    slug: 'erp-sync',
    name: 'ERP Sync',
    url: 'https://erp.mesamfg.example/api/sync',
    method: 'POST',
    authKind: 'basic',
    reachability: 'public',
  },
  {
    customerSlug: 'mesa-manufacturing',
    slug: 'shop-floor',
    name: 'Shop Floor Workflow',
    url: 'https://erp.mesamfg.example/api/workflow',
    method: 'POST',
    authKind: 'basic',
    reachability: 'public',
  },

  // Salt River Logistics — 2 targets
  {
    customerSlug: 'salt-river-logistics',
    slug: 'tms',
    name: 'TMS Gateway',
    url: 'https://tms.saltriverlogistics.example/api/v1',
    method: 'POST',
    authKind: 'bearer',
    reachability: 'public',
  },
  {
    customerSlug: 'salt-river-logistics',
    slug: 'tracking-feed',
    name: 'Tracking Feed',
    url: 'https://tms.saltriverlogistics.example/feed',
    method: 'GET',
    authKind: 'bearer',
    reachability: 'public',
  },

  // Tempe Tech Group — 2 targets
  {
    customerSlug: 'tempe-tech-group',
    slug: 'billing-api',
    name: 'Billing API',
    url: 'https://api.tempetech.example/billing',
    method: 'POST',
    authKind: 'bearer',
    reachability: 'public',
  },
  {
    customerSlug: 'tempe-tech-group',
    slug: 'reports',
    name: 'Reports Endpoint',
    url: 'https://api.tempetech.example/reports',
    method: 'GET',
    authKind: 'bearer',
    reachability: 'public',
  },

  // Skyline Realty Trust — 2 targets
  {
    customerSlug: 'skyline-realty-trust',
    slug: 'listings-feed',
    name: 'MLS Listings Feed',
    url: 'https://mls.skyline-realty.example/feed/v3',
    method: 'GET',
    authKind: 'header',
    reachability: 'public',
  },
  {
    customerSlug: 'skyline-realty-trust',
    slug: 'reports',
    name: 'Sales Reports',
    url: 'https://reports.skyline-realty.example/api/sales',
    method: 'POST',
    authKind: 'bearer',
    reachability: 'public',
  },

  // SwitchThink (internal) — 4 targets
  {
    customerSlug: 'switchthink',
    slug: 'sla-monitor',
    name: 'SLA Monitor',
    url: 'https://api.switchthink.com/internal/sla',
    method: 'GET',
    authKind: 'bearer',
    reachability: 'public',
  },
  {
    customerSlug: 'switchthink',
    slug: 'autotask-sync',
    name: 'Autotask Sync',
    url: 'https://webservices.autotask.net/atservices/1.6/atws.asmx',
    method: 'POST',
    authKind: 'basic',
    reachability: 'public',
  },
  {
    customerSlug: 'switchthink',
    slug: 'ops-cleanup',
    name: 'Ops Cleanup',
    url: 'https://api.switchthink.internal/ops/cleanup',
    method: 'POST',
    authKind: 'bearer',
    reachability: 'tunnel',
  },
  {
    customerSlug: 'switchthink',
    slug: 'health-probe',
    name: 'Health Probe',
    url: 'https://api.switchthink.com/health',
    method: 'GET',
    authKind: 'none',
    reachability: 'public',
  },
]

type TargetInsert = InferInsertModel<typeof targets>

export function targetRow(
  spec: DemoTargetSpec,
  customerId: string,
  customerCreatedAt: Date,
): TargetInsert {
  return {
    id: demoId('tgt', spec.customerSlug, spec.slug),
    customerId,
    name: spec.name,
    slug: spec.slug,
    url: spec.url,
    method: spec.method,
    authKind: spec.authKind,
    authConfig: spec.authKind === 'none' ? null : '{}',
    reachability: spec.reachability,
    status: 'active',
    createdAt: customerCreatedAt,
    updatedAt: customerCreatedAt,
  }
}
