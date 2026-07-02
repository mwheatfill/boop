import { logWarn } from '@/lib/log'

// Microsoft Graph directory read for the recipient picker. App-only (client
// credentials) auth on a dedicated app (User.ReadBasic.All + Group.Read.All),
// separate from the mail-send app so a directory outage or a missing secret
// never affects sending. Verified against Microsoft Learn (Graph /users and
// /groups support $search with the ConsistencyLevel: eventual header).

export interface DirectoryConfig {
  tenantId: string
  clientId: string
  clientSecret: string
}

export interface DirectoryEnv {
  GRAPH_TENANT_ID?: string
  GRAPH_DIR_CLIENT_ID?: string
  GRAPH_DIR_CLIENT_SECRET?: string
}

export type DirectoryRecipientType = 'user' | 'group'

export interface DirectoryRecipient {
  id: string
  displayName: string
  mail: string
  type: DirectoryRecipientType
}

const LOGIN_BASE = 'https://login.microsoftonline.com'
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const RESULT_CAP = 15
const PER_KIND_TOP = 10

export function directoryConfigFromEnv(env: DirectoryEnv): DirectoryConfig | null {
  const tenantId = env.GRAPH_TENANT_ID?.trim()
  const clientId = env.GRAPH_DIR_CLIENT_ID?.trim()
  const clientSecret = env.GRAPH_DIR_CLIENT_SECRET?.trim()
  if (!tenantId || !clientId || !clientSecret) return null
  return { tenantId, clientId, clientSecret }
}

async function requestToken(
  config: DirectoryConfig,
  fetchImpl: typeof fetch,
): Promise<string | null> {
  try {
    const res = await fetchImpl(
      `${LOGIN_BASE}/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      },
    )
    if (!res.ok) {
      logWarn('directory.token.error', { status: res.status })
      return null
    }
    const json = (await res.json().catch(() => null)) as { access_token?: string } | null
    return json?.access_token ?? null
  } catch (err) {
    logWarn('directory.token.error', { error: errText(err) })
    return null
  }
}

interface RawGraphEntry {
  id?: string
  displayName?: string
  mail?: string
}

// A single Graph listing (users or groups). Any non-200 or thrown error yields
// [] so a partial directory outage degrades to fewer suggestions, never a broken
// form. Entries without a mail are dropped (they can't receive alerts).
async function fetchList(
  url: string,
  token: string,
  type: DirectoryRecipientType,
  fetchImpl: typeof fetch,
): Promise<DirectoryRecipient[]> {
  try {
    const res = await fetchImpl(url, {
      headers: { authorization: `Bearer ${token}`, ConsistencyLevel: 'eventual' },
    })
    if (!res.ok) {
      logWarn('directory.search.error', { type, status: res.status })
      return []
    }
    const json = (await res.json().catch(() => null)) as { value?: RawGraphEntry[] } | null
    return (json?.value ?? []).flatMap((entry) => {
      const mail = entry.mail?.trim()
      if (!entry.id || !mail) return []
      return [{ id: entry.id, displayName: entry.displayName?.trim() || mail, mail, type }]
    })
  } catch (err) {
    logWarn('directory.search.error', { type, error: errText(err) })
    return []
  }
}

function searchUsers(
  token: string,
  q: string,
  fetchImpl: typeof fetch,
): Promise<DirectoryRecipient[]> {
  const search = encodeURIComponent(`"displayName:${q}" OR "mail:${q}"`)
  const url = `${GRAPH_BASE}/users?$search=${search}&$select=id,displayName,mail,userPrincipalName&$top=${PER_KIND_TOP}&$count=true`
  return fetchList(url, token, 'user', fetchImpl)
}

function searchGroups(
  token: string,
  q: string,
  fetchImpl: typeof fetch,
): Promise<DirectoryRecipient[]> {
  const filter = encodeURIComponent('mailEnabled eq true')
  const search = encodeURIComponent(`"displayName:${q}"`)
  const url = `${GRAPH_BASE}/groups?$filter=${filter}&$search=${search}&$select=id,displayName,mail&$top=${PER_KIND_TOP}&$count=true`
  return fetchList(url, token, 'group', fetchImpl)
}

// Searches Entra users and mail-enabled groups for a query, resolving each to its
// email. Users first, then groups, capped. Returns [] for an empty query or any
// failure (token, network, non-200) so a Graph problem never breaks the picker.
export async function searchDirectory(
  config: DirectoryConfig,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DirectoryRecipient[]> {
  const q = query.trim()
  if (!q) return []
  const token = await requestToken(config, fetchImpl)
  if (!token) return []
  const [users, groups] = await Promise.all([
    searchUsers(token, q, fetchImpl),
    searchGroups(token, q, fetchImpl),
  ])
  return [...users, ...groups].slice(0, RESULT_CAP)
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : 'network error'
}
