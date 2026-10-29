import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Text,
} from '@react-email/components'
import { BrandingFooter } from './branding-footer'
import type { PublishedEmailBranding } from '@/lib/email-branding.server'

interface SignupEmailProps {
  branding: PublishedEmailBranding
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ branding, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez votre adresse e-mail pour {branding.commercialName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirmez votre adresse e-mail</Heading>
        <Text style={text}>
          Merci de vous être inscrit·e sur{' '}
          <Link href={branding.publicSiteUrl} style={link}>
            <strong>{branding.commercialName}</strong>
          </Link>.
        </Text>
        <Text style={text}>
          Confirmez votre adresse ({recipient}) en cliquant sur le bouton ci-dessous :
        </Text>
        <Button style={button} href={confirmationUrl}>Confirmer mon e-mail</Button>
        <Text style={footer}>Si vous n'êtes pas à l'origine de cette inscription, ignorez cet e-mail.</Text>
        <BrandingFooter branding={branding} />
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: 'inherit', textDecoration: 'underline' as const }
const button = { backgroundColor: '#000', color: '#fff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' as const }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }