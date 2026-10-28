import * as React from 'react'
import { Hr, Link, Text, Img } from '@react-email/components'
import type { PublishedEmailBranding } from '@/lib/email-branding.server'

/**
 * Bloc H2c — Pied de page unifié pour les e-mails d'authentification.
 * Le branding VISUEL provient de `platform_public_settings` (versions publiées uniquement).
 * L'expéditeur technique (from/senderDomain) reste contrôlé côté serveur (webhook.ts).
 */
export function BrandingFooter({ branding }: { branding: PublishedEmailBranding }) {
  const links: Array<{ label: string; url: string }> = []
  links.push({ label: 'Site', url: branding.publicSiteUrl })
  links.push({ label: 'Contact', url: branding.contactUrl })
  links.push({ label: 'Confidentialité', url: branding.privacyUrl })
  links.push({ label: 'Mentions légales', url: branding.legalNoticeUrl })

  return (
    <>
      <Hr style={{ borderColor: '#eaeaea', margin: '32px 0 16px' }} />
      {branding.logoUrl ? (
        <Img
          src={branding.logoUrl}
          alt={branding.commercialName}
          height="24"
          style={{ marginBottom: 12 }}
        />
      ) : null}
      <Text style={foot}>
        <strong>{branding.commercialName}</strong>
        {branding.supportEmail ? (
          <>
            {' — '}
            <Link href={`mailto:${branding.supportEmail}`} style={link}>
              {branding.supportEmail}
            </Link>
          </>
        ) : null}
      </Text>
      <Text style={foot}>
        {links.map((l, i) => (
          <React.Fragment key={l.url}>
            {i > 0 ? ' · ' : ''}
            <Link href={l.url} style={link}>
              {l.label}
            </Link>
          </React.Fragment>
        ))}
      </Text>
      {branding.copyrightText ? (
        <Text style={{ ...foot, color: '#999' }}>{branding.copyrightText}</Text>
      ) : null}
    </>
  )
}

const foot = {
  fontSize: '12px',
  color: '#666',
  margin: '4px 0',
  lineHeight: '1.4' as const,
}
const link = { color: '#333', textDecoration: 'underline' as const }