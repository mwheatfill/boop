import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChannelConfigDetails } from './ChannelConfigDetails'

describe('ChannelConfigDetails', () => {
  it('renders a Teams webhook URL', () => {
    render(
      <ChannelConfigDetails
        config={{ kind: 'teams', webhook_url: 'https://teams.example/hook' }}
      />,
    )
    expect(screen.getByText('Webhook URL')).toBeTruthy()
    expect(screen.getByText('https://teams.example/hook')).toBeTruthy()
  })

  it('renders email recipients as chips plus subject and body', () => {
    render(
      <ChannelConfigDetails
        config={{
          kind: 'email',
          recipients: ['a@x.com', 'b@x.com'],
          subject_template: 'Subject line',
          body_template: 'Body line',
        }}
      />,
    )
    expect(screen.getByText('a@x.com')).toBeTruthy()
    expect(screen.getByText('b@x.com')).toBeTruthy()
    expect(screen.getByText('Subject line')).toBeTruthy()
    expect(screen.getByText('Body line')).toBeTruthy()
  })

  it('renders a webhook method badge and header pairs', () => {
    render(
      <ChannelConfigDetails
        config={{
          kind: 'webhook',
          url: 'https://x.test/hook',
          method: 'PUT',
          headers: { 'X-Api-Key': 'secret' },
          body_template: '{{ alert_context_json }}',
        }}
      />,
    )
    expect(screen.getByText('PUT')).toBeTruthy()
    expect(screen.getByText('X-Api-Key')).toBeTruthy()
    expect(screen.getByText('secret')).toBeTruthy()
  })

  it('shows "None" when a webhook has no headers', () => {
    render(
      <ChannelConfigDetails
        config={{
          kind: 'webhook',
          url: 'https://x.test/hook',
          method: 'POST',
          headers: {},
          body_template: 'x',
        }}
      />,
    )
    expect(screen.getByText('None')).toBeTruthy()
  })
})
