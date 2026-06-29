export interface MailerMessage {
  to: string[]
  subject: string
  html: string
  text: string
}

export interface MailerResult {
  ok: boolean
  reason?: string
  retryable?: boolean
}

export type Mailer = (message: MailerMessage) => Promise<MailerResult>

// The email/send-pipeline recipe is installed (Microsoft Graph shared-mailbox
// transport, see ./graph and docs/agents/email-graph-setup.md). The client uses
// this to decide whether to offer the email Channel kind; actual GRAPH_* config
// is read server-side in the email channel adapter, so this module stays free of
// the Worker runtime and safe to import from the browser bundle.
export const EMAIL_RECIPE_INSTALLED = true
