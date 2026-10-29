import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'
import { BrandingFooter } from './branding-footer'
import type { PublishedEmailBranding } from '@/lib/email-branding.server'

interface InviteEmailProps {
  branding: PublishedEmailBranding
  confirmationUrl: string
}

export const InviteEmail = ({ branding, confirmationUrl }: InviteEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Vous êtes invité·e à rejoindre {branding.commercialName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Vous êtes invité·e</Heading>
        <Text style={text}>
          Vous avez été invité·e à rejoindre{' '}
          <Link href={branding.publicSiteUrl} style={link}><strong>{branding.commercialName}</strong></Link>.
          Cliquez sur le bouton ci-dessous pour accepter l'invitation et créer votre compte.
        </Text>
        <Button style={button} href={confirmationUrl}>Accepter l'invitation</Button>
        <Text style={footer}>Si vous n'attendiez pas cette invitation, ignorez cet e-mail.</Text>
        <BrandingFooter branding={branding} />
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: 'inherit', textDecoration: 'underline' as const }
const button = { backgroundColor: '#000', color: '#fff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' as const }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }