import { env } from 'cloudflare:workers'
import type { ReactElement } from 'react'
import { render } from 'react-email'

export type SendEmailInput = {
  to: string
  from: string
  subject: string
  template: ReactElement
  replyTo?: string
}

export type SendEmailResult = {
  id?: string
  ok: boolean
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const html = await render(input.template)
  const text = await render(input.template, { plainText: true })

  switch (env.EMAIL_TRANSPORT) {
    case 'resend':
      return sendViaResend({ ...input, html, text })
    case 'graph':
      return sendViaGraph({ ...input, html, text })
    case 'cloudflare-email':
      return sendViaCloudflareEmail({ ...input, html, text })
    default:
      throw new Error(
        'EMAIL_TRANSPORT is not set. Install one of the email recipes: ' +
          'email/resend, email/graph-shared-mailbox, or email/cloudflare-email-service.',
      )
  }
}

type RenderedSendInput = SendEmailInput & { html: string; text: string }

function sendViaResend(_input: RenderedSendInput): Promise<SendEmailResult> {
  throw new Error('Resend transport: install the email/resend recipe to enable this code path.')
}

function sendViaGraph(_input: RenderedSendInput): Promise<SendEmailResult> {
  throw new Error(
    'Microsoft Graph transport: install the email/graph-shared-mailbox recipe to enable this code path.',
  )
}

function sendViaCloudflareEmail(_input: RenderedSendInput): Promise<SendEmailResult> {
  throw new Error(
    'Cloudflare Email Service transport: install the email/cloudflare-email-service recipe to enable this code path.',
  )
}
