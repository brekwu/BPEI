import * as React from 'react'
import { createAuthEmailHandler } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'
import { getPublishedEmailBranding } from '@/lib/email-branding.server'

// EXPÉDITEUR TECHNIQUE — verrouillé côté serveur. Ne JAMAIS le remplacer par
// une valeur saisie dans l'administration. Le domaine émetteur reste
// notify.bpei.fr (validé DNS/DKIM/DMARC).
const SITE_NAME = 'pro-repair-connect'
const SENDER_DOMAIN = 'notify.bpei.fr'
const FROM_DOMAIN = 'notify.bpei.fr'

// BRANDING VISUEL — résolu à chaque envoi depuis platform_public_settings
// (versions PUBLIÉES uniquement, jamais de draft).
const handler = process.env.LOVABLE_API_KEY ? createAuthEmailHandler({
  apiKey: process.env.LOVABLE_API_KEY!,
  from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
  senderDomain: SENDER_DOMAIN,
  sendUrl: process.env.LOVABLE_SEND_URL,
  emails: {
    signup: {
      subject: 'Confirmez votre adresse e-mail',
      render: async (data) => {
        const branding = await getPublishedEmailBranding()
        return React.createElement(SignupEmail, {
          branding,
          recipient: data.email,
          confirmationUrl: data.url,
        })
      },
    },
    invite: {
      subject: 'Vous êtes invité·e',
      render: async (data) => {
        const branding = await getPublishedEmailBranding()
        return React.createElement(InviteEmail, { branding, confirmationUrl: data.url })
      },
    },
    magiclink: {
      subject: 'Votre lien de connexion',
      render: async (data) => {
        const branding = await getPublishedEmailBranding()
        return React.createElement(MagicLinkEmail, { branding, confirmationUrl: data.url })
      },
    },
    recovery: {
      subject: 'Réinitialisez votre mot de passe',
      render: async (data) => {
        const branding = await getPublishedEmailBranding()
        return React.createElement(RecoveryEmail, { branding, confirmationUrl: data.url })
      },
    },
    email_change: {
      subject: 'Confirmez votre nouvelle adresse e-mail',
      render: async (data) => {
        const branding = await getPublishedEmailBranding()
        return React.createElement(EmailChangeEmail, {
          branding,
          oldEmail: data.old_email ?? '',
          email: data.email,
          newEmail: data.new_email ?? '',
          confirmationUrl: data.url,
        })
      },
    },
    reauthentication: {
      subject: 'Votre code de vérification',
      render: async (data) => {
        const branding = await getPublishedEmailBranding()
        return React.createElement(ReauthenticationEmail, {
          branding,
          token: data.token ?? '',
        })
      },
    },
  },
}) : null

export const Route = createFileRoute('/lovable/email/auth/webhook')({
  server: {
    handlers: {
      POST: ({ request }) => handler
        ? handler(request)
        : Response.json({ error: 'Auth email service is not configured on this host' }, { status: 503 }),
    },
  },
})