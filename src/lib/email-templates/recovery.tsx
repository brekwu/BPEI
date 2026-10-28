import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import { BrandingFooter } from './branding-footer'
import type { PublishedEmailBranding } from '@/lib/email-branding.server'

interface RecoveryEmailProps {
  branding: PublishedEmailBranding
  confirmationUrl: string
}

export const RecoveryEmail = ({ branding, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Réinitialisez votre mot de passe pour {branding.commercialName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Réinitialiser votre mot de passe</Heading>
        <Text style={text}>
          Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte {branding.commercialName}.
          Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
        </Text>
        <Button style={button} href={confirmationUrl}>Réinitialiser le mot de passe</Button>
        <Text style={footer}>
          Si vous n'avez pas fait cette demande, ignorez cet e-mail. Votre mot de passe restera inchangé.
        </Text>
        <BrandingFooter branding={branding} />
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 25px' }
const button = { backgroundColor: '#000', color: '#fff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' as const }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }