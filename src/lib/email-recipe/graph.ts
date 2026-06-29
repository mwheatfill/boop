import type { MailerMessage, MailerResult } from './index'

// Microsoft Graph send-mail transport for the email/send-pipeline recipe.
// App-only (client credentials) auth; sends as a shared mailbox via
// POST /users/{sender}/sendMail. Verified against Microsoft Learn (Graph
// user:sendMail returns 202 Accepted; client credentials uses the .default scope).

export interface GraphMailConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  sender: string
}

export interface GraphMailEnv {
  GRAPH_TENANT_ID?: string
  GRAPH_CLIENT_ID?: string
  GRAPH_CLIENT_SECRET?: string
  GRAPH_MAIL_SENDER?: string
}

const LOGIN_BASE = 'https://login.microsoftonline.com'
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

export function graphConfigFromEnv(env: GraphMailEnv): GraphMailConfig | null {
  const tenantId = env.GRAPH_TENANT_ID?.trim()
  const clientId = env.GRAPH_CLIENT_ID?.trim()
  const clientSecret = env.GRAPH_CLIENT_SECRET?.trim()
  const sender = env.GRAPH_MAIL_SENDER?.trim()
  if (!tenantId || !clientId || !clientSecret || !sender) return null
  return { tenantId, clientId, clientSecret, sender }
}

// A 5xx or 429 is transient (retry); a 4xx is a config/permission problem (don't).
function transient(status: number): boolean {
  return status >= 500 || status === 429
}

type TokenResult = { ok: true; token: string } | { ok: false; retryable: boolean; reason: string }

async function requestToken(
  config: GraphMailConfig,
  fetchImpl: typeof fetch,
): Promise<TokenResult> {
  let res: Response
  try {
    res = await fetchImpl(
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
  } catch (err) {
    return { ok: false, retryable: true, reason: `token request failed: ${errText(err)}` }
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return {
      ok: false,
      retryable: transient(res.status),
      reason: `token ${res.status}: ${cap(detail)}`,
    }
  }
  const json = (await res.json().catch(() => null)) as { access_token?: string } | null
  if (!json?.access_token) {
    return { ok: false, retryable: false, reason: 'token response missing access_token' }
  }
  return { ok: true, token: json.access_token }
}

export async function sendViaGraph(
  config: GraphMailConfig,
  message: MailerMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<MailerResult> {
  const token = await requestToken(config, fetchImpl)
  if (!token.ok) return { ok: false, retryable: token.retryable, reason: token.reason }

  let res: Response
  try {
    res = await fetchImpl(`${GRAPH_BASE}/users/${encodeURIComponent(config.sender)}/sendMail`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: message.subject,
          body: { contentType: 'HTML', content: message.html },
          toRecipients: message.to.map((address) => ({ emailAddress: { address } })),
        },
        saveToSentItems: false,
      }),
    })
  } catch (err) {
    return { ok: false, retryable: true, reason: `sendMail failed: ${errText(err)}` }
  }
  if (res.status === 202) return { ok: true }
  const detail = await res.text().catch(() => '')
  return {
    ok: false,
    retryable: transient(res.status),
    reason: `sendMail ${res.status}: ${cap(detail)}`,
  }
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : 'network error'
}

function cap(text: string): string {
  return text.slice(0, 200)
}
