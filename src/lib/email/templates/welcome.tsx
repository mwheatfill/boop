import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from 'react-email'

export type WelcomeEmailProps = {
  name: string
  appName: string
  appUrl: string
}

export function WelcomeEmail({ name, appName, appUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Welcome to ${appName}`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>{`Welcome, ${name}.`}</Heading>
          <Section>
            <Text style={text}>{`Thanks for signing up for ${appName}.`}</Text>
            <Text style={text}>
              <Link href={appUrl} style={link}>
                Open the app
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

WelcomeEmail.PreviewProps = {
  name: 'Alex',
  appName: 'template-cf-fullstack',
  appUrl: 'https://example.com',
} satisfies WelcomeEmailProps

export default WelcomeEmail

const body = {
  backgroundColor: '#ffffff',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  margin: 0,
  padding: '24px',
}

const container = {
  margin: '0 auto',
  maxWidth: '480px',
}

const heading = {
  color: '#0a0a0a',
  fontSize: '24px',
  fontWeight: 600,
  marginTop: 0,
}

const text = {
  color: '#404040',
  fontSize: '14px',
  lineHeight: 1.6,
}

const link = {
  color: '#0a0a0a',
  textDecoration: 'underline',
}
