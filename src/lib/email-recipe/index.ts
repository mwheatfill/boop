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

export const mailer: Mailer | null = null

export function isEmailRecipeAvailable(): boolean {
  return mailer !== null
}
