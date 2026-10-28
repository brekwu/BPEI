import * as React from 'react'
import { render } from '@react-email/render'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'
import { getPublishedEmailBranding } from '@/lib/email-branding.server'

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

const SAMPLE_PROJECT_URL = "https://pro-repair-connect.lovable.app"
const SAMPLE_EMAIL = "user@example.test"

function sampleData(
  type: string,
  branding: Awaited<ReturnType<typeof getPublishedEmailBranding>>,
): Record<string, unknown> {
  switch (type) {
    case 'signup':
      return { branding, recipient: SAMPLE_EMAIL, confirmationUrl: SAMPLE_PROJECT_URL }
    case 'invite':
    case 'magiclink':
    case 'recovery':
      return { branding, confirmationUrl: SAMPLE_PROJECT_URL }
    case 'email_change':
      return {
        branding,
        oldEmail: SAMPLE_EMAIL,
        email: SAMPLE_EMAIL,
        newEmail: SAMPLE_EMAIL,
        confirmationUrl: SAMPLE_PROJECT_URL,
      }
    case 'reauthentication':
      return { branding, token: '123456' }
    default:
      return { branding }
  }
}

export const Route = createFileRoute("/lovable/email/auth/preview")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY
        if (!apiKey) return Response.json({ error: 'Server configuration error' }, { status: 500 })

        const authHeader = request.headers.get('Authorization')
        if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let type: string
        try {
          const body = await request.json()
          type = body.type
        } catch {
          return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 })
        }

        const EmailTemplate = EMAIL_TEMPLATES[type]
        if (!EmailTemplate) return Response.json({ error: `Unknown email type: ${type}` }, { status: 400 })

        const branding = await getPublishedEmailBranding()
        const html = await render(React.createElement(EmailTemplate, sampleData(type, branding)))
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      },
    },
  },
})