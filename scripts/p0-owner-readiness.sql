-- BPEI P0 — diagnostic confidentiel pour le titulaire du SQL Editor Supabase.
-- LECTURE SEULE : aucune ligne créée, aucun rôle attribué, aucun flag activé.
-- Exécuter sur qmbsfmcotnsxsvbigynz avec un compte opérateur autorisé.
-- Ce rapport ne peut pas confirmer de lui-même la livraison d'un mail ou une signature.
WITH facts AS (
  SELECT
    (SELECT count(*) FROM auth.users) AS auth_users,
    (SELECT count(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL AND deleted_at IS NULL AND is_anonymous IS NOT TRUE) AS confirmed_auth_users,
    (SELECT count(*) FROM public.independent_admins a
      JOIN auth.users u ON u.id=a.user_id
      WHERE u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE) AS confirmed_admins,
    (SELECT count(*) FROM public.bpei_legal_releases) AS published_legal_releases,
    (SELECT c.legal_version FROM public.bpei_launch_controls c WHERE c.id=true) AS current_legal_version,
    (SELECT count(DISTINCT d.kind)
       FROM public.bpei_legal_documents d
       JOIN public.bpei_launch_controls c ON c.id=true AND c.legal_version=d.version
       JOIN public.bpei_legal_releases r ON r.version=d.version
       WHERE d.kind IN ('mentions-legales','confidentialite','cgu')
         AND c.legal_documents_published IS TRUE
    ) AS approved_current_legal_docs,
    (SELECT count(*) FROM public.bpei_service_invoices i
      JOIN public.bpei_service_quotes q ON q.id=i.quote_id AND q.issuer_id=i.issuer_id
      WHERE q.status='accepted' AND q.accepted_at IS NOT NULL
        AND nullif(btrim(q.acceptance_reference),'') IS NOT NULL) AS invoices,
    (SELECT count(*) FROM public.bpei_service_quotes
      WHERE status='accepted' AND accepted_at IS NOT NULL
      AND nullif(btrim(acceptance_reference),'') IS NOT NULL) AS accepted_quotes,
    (SELECT count(*) FROM public.bpei_stripe_connected_accounts
      WHERE test_enabled IS TRUE AND test_verified_at IS NOT NULL) AS verified_test_merchants,
    (SELECT count(*)
      FROM public.bpei_payment_attempts p
      JOIN public.bpei_stripe_connected_accounts m
        ON m.issuer_id = p.issuer_id AND m.stripe_account_id = p.connected_account_id
      JOIN public.bpei_service_invoices i
        ON i.id = p.invoice_id AND i.issuer_id = p.issuer_id
      JOIN public.bpei_service_quotes q ON q.id = i.quote_id AND q.issuer_id = i.issuer_id
      WHERE p.paid_at IS NOT NULL AND p.state = 'paid'
        AND p.checkout_session_id LIKE 'cs_test_%'
        AND p.currency = 'eur'
        AND p.amount_cents = q.gross_cents
        AND m.test_enabled IS TRUE AND m.test_verified_at IS NOT NULL
        AND q.status = 'accepted' AND q.accepted_at IS NOT NULL
        AND nullif(btrim(q.acceptance_reference),'') IS NOT NULL
    ) AS paid_test_attempts,
    (SELECT count(*) FROM public.bpei_commercial_mail_outbox
      WHERE status='sent') AS provider_accepted_mail,
    (SELECT count(*) FROM public.bpei_p0_attestations) AS attestation_count,
    (SELECT count(*) FROM public.bpei_p0_attestations WHERE check_key='smtp_auth_delivery') > 0 AS smtp_attested,
    (SELECT count(*) FROM public.bpei_p0_attestations WHERE check_key='legal_operator_review') > 0 AS legal_attested,
    (SELECT count(*) FROM public.bpei_p0_attestations WHERE check_key='commercial_sender_receipt') > 0 AS mail_attested,
    (SELECT count(*) FROM public.bpei_p0_attestations WHERE check_key='partner_commission_signed') > 0 AS contract_attested,
    (SELECT count(*) FROM public.bpei_p0_attestations WHERE check_key='e_invoice_platform_receipt') > 0 AS einvoice_attested,
    (SELECT count(*) FROM public.bpei_p0_attestations WHERE check_key='stripe_test_payment') > 0 AS stripe_attested,
    (SELECT count(*) FROM public.bpei_p0_attestations WHERE check_key='full_pilot_verified') > 0 AS pilot_attested,
    (SELECT legal_documents_published FROM public.bpei_launch_controls WHERE id=true) IS TRUE AS legal_flag,
    (SELECT independent_registration_enabled FROM public.bpei_launch_controls WHERE id=true) IS TRUE AS registration_flag,
    (SELECT enabled AND validated_legal_sender FROM public.bpei_commercial_mail_controls WHERE id=true) IS TRUE AS mail_flag,
    (SELECT test_checkout_enabled FROM public.bpei_payment_controls WHERE id=true) IS TRUE AS stripe_flag
), checkpoints AS (
  SELECT 1 AS ordinal, 'Administrateur confirmé'::text AS checkpoint,
    confirmed_admins >= 1 AS technical_conditions,
    format('%s administrateur(s) Auth confirmé(s)',confirmed_admins) AS evidence,
    'Un vrai compte Auth confirmé et un rôle attribué explicitement'::text AS next_step
  FROM facts
  UNION ALL SELECT 2,'SMTP / confirmation e-mail',
    confirmed_auth_users >= 1 AND smtp_attested,
    format('%s compte(s) confirmés, preuve de livraison enregistrée : %s',confirmed_auth_users,smtp_attested),
    'Configurer un fournisseur SMTP valide, recevoir et ouvrir réellement le lien' FROM facts
  UNION ALL SELECT 3,'Juridique',
    approved_current_legal_docs = 3 AND legal_flag AND legal_attested,
    format('%s/3 document(s) approuvé(s) sur version courante %s, publication %s, revue %s',
      approved_current_legal_docs,coalesce(current_legal_version,'(aucune)'),legal_flag,legal_attested),
    'Faire approuver puis publier les textes et contrats vérifiés par le responsable légal' FROM facts
  UNION ALL SELECT 4,'Envoi devis / factures',
    mail_flag AND provider_accepted_mail > 0 AND mail_attested,
    format('Expéditeur validé %s, envoi(s) fournisseur %s, preuve de réception %s',
      mail_flag,provider_accepted_mail,mail_attested),
    'Vérifier l’expéditeur et la réception réelle du document par son destinataire' FROM facts
  UNION ALL SELECT 5,'Commissions / facturation électronique',
    contract_attested AND einvoice_attested,
    format('Convention signée %s, plateforme agréée %s',contract_attested,einvoice_attested),
    'Documenter les flux contractuels et retenir la plateforme agréée appropriée' FROM facts
  UNION ALL SELECT 6,'Stripe TEST',
    stripe_flag AND stripe_attested AND verified_test_merchants > 0 AND paid_test_attempts > 0,
    format('Flag test %s, marchand(s) test vérifié(s) %s, tentatives payées %s, attestation %s',
      stripe_flag,verified_test_merchants,paid_test_attempts,stripe_attested),
    'Compte marchand de test identifié, webhook signé et paiement de test réellement rapproché' FROM facts
  UNION ALL SELECT 7,'Pilote de bout en bout',
    confirmed_auth_users >= 2 AND accepted_quotes > 0 AND invoices > 0
      AND paid_test_attempts > 0 AND pilot_attested,
    format('%s compte(s) confirmés, %s devis accepté(s), %s facture(s), %s paiement(s) rapproché(s), preuve pilote %s',
      confirmed_auth_users,accepted_quotes,invoices,paid_test_attempts,pilot_attested),
    'Tester un vrai partenaire et un vrai client autorisés, devis, facture et permissions' FROM facts
)
SELECT ordinal,checkpoint,
       CASE WHEN technical_conditions THEN 'CONDITIONS SQL PRESENTES — preuve externe à vérifier'
            ELSE 'NON PRET' END AS status,
       evidence,next_step
FROM checkpoints ORDER BY ordinal;
