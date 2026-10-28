import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import { BrandingFooter } from './branding-footer'
import type { PublishedEmailBranding } from '@/lib/email-branding.server'

interface ReauthenticationEmailProps {
  branding: PublishedEmailBranding
  token: string
}

export const ReauthenticationEmail = ({ branding, token }: ReauthenticationEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre code de vérification {branding.commercialName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Confirmer la réauthentification</Heading>
        <Text style={text}>Utilisez le code ci-dessous pour confirmer votre identité :</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>Ce code expirera bientôt. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</Text>
        <BrandingFooter branding={branding} />
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 25px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '22px', fontWeight: 'bold' as const, color: '#000', margin: '0 0 30px' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }