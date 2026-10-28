import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import { BrandingFooter } from './branding-footer'
import type { PublishedEmailBranding } from '@/lib/email-branding.server'

interface MagicLinkEmailProps {
  branding: PublishedEmailBranding
  confirmationUrl: string
}

export const MagicLinkEmail = ({ branding, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre lien de connexion pour {branding.commercialName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Votre lien de connexion</Heading>
        <Text style={text}>
          Cliquez sur le bouton ci-dessous pour vous connecter à {branding.commercialName}. Ce lien expirera bientôt.
        </Text>
        <Button style={button} href={confirmationUrl}>Se connecter</Button>
        <Text style={footer}>Si vous n'avez pas demandé ce lien, ignorez cet e-mail.</Text>
        <BrandingFooter branding={branding} />
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 25px' }
const button = { backgroundColor: '#000', color: '#fff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' as const }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }