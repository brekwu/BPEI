import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { BrandingFooter } from './branding-footer'
import type { PublishedEmailBranding } from '@/lib/email-branding.server'

interface EmailChangeEmailProps {
  branding: PublishedEmailBranding
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ branding, oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez le changement d'adresse e-mail pour {branding.commercialName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirmer le changement d'e-mail</Heading>
        <Text style={text}>
          Vous avez demandé à modifier l'adresse e-mail de votre compte {branding.commercialName} de{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link>{' '}
          vers <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Text style={text}>Cliquez sur le bouton ci-dessous pour confirmer ce changement :</Text>
        <Button style={button} href={confirmationUrl}>Confirmer le changement</Button>
        <Text style={footer}>
          Si vous n'êtes pas à l'origine de cette demande, sécurisez votre compte immédiatement.
        </Text>
        <BrandingFooter branding={branding} />
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: 'inherit', textDecoration: 'underline' as const }
const button = { backgroundColor: '#000', color: '#fff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' as const }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }