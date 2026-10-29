DO $$
DECLARE
  v_owner_a uuid := '1a2c66dc-e634-4873-8c48-e786417fb2d3';
  v_owner_b uuid := '68711c2d-888c-4a75-bc28-c9c88d864589';
  v_shop_a  uuid := 'a0000000-0000-0000-0000-00000000000a';
  v_shop_b  uuid := 'b0000000-0000-0000-0000-00000000000b';
  v_shop_d  uuid := 'd0000000-0000-0000-0000-00000000000d';
  v_shop_e  uuid := 'e0000000-0000-0000-0000-00000000000e';
  v_shop_f  uuid := 'f0000000-0000-0000-0000-00000000000f';
  v_shop_g  uuid := '00000000-0000-0000-0000-0000000000a1';
  v_shop_h  uuid := '00000000-0000-0000-0000-0000000000a2';
  v_opp1    uuid := '10000000-0000-0000-0000-000000000001';
  v_opp2    uuid := '10000000-0000-0000-0000-000000000002';
  v_opp3    uuid := '10000000-0000-0000-0000-000000000003';
  v_app1    uuid := '20000000-0000-0000-0000-000000000001';
  v_app2    uuid := '20000000-0000-0000-0000-000000000002';
  v_app3    uuid := '20000000-0000-0000-0000-000000000003';
  v_app4    uuid := '20000000-0000-0000-0000-000000000004';
  v_agr_active     uuid := '30000000-0000-0000-0000-000000000001';
  v_agr_proposed   uuid := '30000000-0000-0000-0000-000000000002';
  v_agr_suspended  uuid := '30000000-0000-0000-0000-000000000003';
  v_agr_expired    uuid := '30000000-0000-0000-0000-000000000004';
  v_agr_terminated uuid := '30000000-0000-0000-0000-000000000005';
BEGIN
  INSERT INTO shops (id, name, public_name, business_type, owner_user_id, status,
                     public_profile_status, city, postal_code, private_city, private_postal_code,
                     verification_status, public_description)
  VALUES
    (v_shop_d, '[TEST] BPEI TEST D', '[TEST] Indépendant D — Paris', 'mobile_independent',
      v_owner_a, 'validated', 'published', NULL, NULL, 'Paris', '75011', 'verified',
      'Réparateur mobile indépendant zone Paris Est.'),
    (v_shop_e, '[TEST] BPEI TEST E', '[TEST] Indépendant E — Lyon', 'mobile_independent',
      v_owner_b, 'validated', 'published', NULL, NULL, 'Lyon', '69003', 'verified',
      'Réparateur mobile indépendant Lyon.'),
    (v_shop_f, '[TEST] BPEI TEST F', '[TEST] Hybride F — Marseille', 'hybrid_business',
      v_owner_a, 'validated', 'published', 'Marseille', '13001', 'Marseille', '13001',
      'verified', 'Atelier hybride avec service mobile.'),
    (v_shop_g, '[TEST] BPEI TEST G', '[TEST] Réseau G — Toulouse', 'multi_location_network',
      v_owner_b, 'validated', 'published', 'Toulouse', '31000', 'Toulouse', '31000',
      'verified', 'Réseau multi-sites région Occitanie.'),
    (v_shop_h, '[TEST] BPEI TEST H', '[TEST] Indépendant H — Bordeaux', 'mobile_independent',
      v_owner_a, 'validated', 'published', NULL, NULL, 'Bordeaux', '33000', 'not_submitted',
      'Indépendant non vérifié.')
  ON CONFLICT (id) DO UPDATE
    SET public_name = EXCLUDED.public_name,
        business_type = EXCLUDED.business_type,
        verification_status = EXCLUDED.verification_status,
        public_profile_status = EXCLUDED.public_profile_status,
        status = EXCLUDED.status;

  INSERT INTO shop_memberships (shop_id, user_id, role)
  VALUES
    (v_shop_d, v_owner_a, 'shop_manager'),
    (v_shop_e, v_owner_b, 'shop_manager'),
    (v_shop_f, v_owner_a, 'shop_manager'),
    (v_shop_g, v_owner_b, 'shop_manager'),
    (v_shop_h, v_owner_a, 'shop_manager')
  ON CONFLICT DO NOTHING;

  INSERT INTO partner_opportunities (id, shop_id, title, description, specialties,
      covered_cities, covered_postal_codes, compensation_model, compensation_details,
      requires_exclusivity, status, created_by, visibility, require_verified)
  VALUES
    (v_opp1, v_shop_a, 'Réparations iPhone — Paris Est',
      'Recherche indépendants pour interventions à domicile clients pro.',
      ARRAY['iphone','écran','batterie'], ARRAY['Paris'],
      ARRAY['75011','75020'], 'commission', '20% du montant TTC',
      false, 'published', v_owner_a, 'public', true),
    (v_opp2, v_shop_a, 'Partenariat exclusif — Réparation Mac',
      'Partenariat exclusif Mac / MacBook sur Paris intra-muros.',
      ARRAY['mac','macbook'], ARRAY['Paris'], ARRAY['75001','75002','75008'],
      'fixed_fee', '80€/intervention', true, 'published', v_owner_a, 'public', true),
    (v_opp3, v_shop_b, 'Réseau Lyon — brouillon',
      'Opportunité en cours de rédaction.',
      ARRAY['android'], ARRAY['Lyon'], ARRAY['69003'],
      'commission', NULL, false, 'draft', v_owner_b, 'public', false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO partner_applications (id, opportunity_id, independent_shop_id, message,
      proposed_rate, status, applied_by)
  VALUES
    (v_app1, v_opp1, v_shop_d, 'Disponible immédiatement, 5 ans d''expérience iPhone.',
      '18% commission', 'pending', v_owner_a),
    (v_app2, v_opp1, v_shop_e, 'Couverture Lyon élargie possible.',
      '20% commission', 'shortlisted', v_owner_b),
    (v_app3, v_opp2, v_shop_f, 'Atelier Mac certifié.',
      '80€/intervention', 'accepted', v_owner_a),
    (v_app4, v_opp1, v_shop_h, 'Candidature en attente de vérification.',
      '15%', 'rejected', v_owner_a)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO partner_agreements (id, shop_id, independent_shop_id, opportunity_id,
      application_id, title, scope, compensation_model, compensation_details,
      requires_exclusivity, exclusivity_kind, start_date, end_date, status, version,
      current_version, shop_signed_at, independent_signed_at, became_active_at,
      terminated_at, terminated_reason, suspended_reason, created_by)
  VALUES
    (v_agr_active, v_shop_a, v_shop_f, v_opp2, v_app3,
      'Accord actif — Mac Paris', 'Réparations Mac Paris centre',
      'fixed_fee', '80€/intervention', true, 'geographic',
      CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '180 days',
      'active', 1, 1, now() - INTERVAL '30 days', now() - INTERVAL '29 days',
      now() - INTERVAL '29 days', NULL, NULL, NULL, v_owner_a),
    (v_agr_proposed, v_shop_a, v_shop_d, v_opp1, v_app1,
      'Accord proposé — iPhone Paris Est', 'iPhone/écran Paris 11-20',
      'commission', '20% TTC', false, 'none',
      CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days',
      'proposed', 1, 1, NULL, NULL, NULL, NULL, NULL, NULL, v_owner_a),
    (v_agr_suspended, v_shop_b, v_shop_e, NULL, NULL,
      'Accord suspendu — Android Lyon', 'Android Lyon',
      'commission', '15% TTC', false, 'none',
      CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '90 days',
      'suspended', 1, 1, now() - INTERVAL '60 days', now() - INTERVAL '59 days',
      now() - INTERVAL '59 days', NULL, NULL, 'Litige facturation en cours', v_owner_b),
    (v_agr_expired, v_shop_a, v_shop_h, NULL, NULL,
      'Accord expiré — Bordeaux', 'Interventions ponctuelles',
      'fixed_fee', '60€/intervention', false, 'none',
      CURRENT_DATE - INTERVAL '180 days', CURRENT_DATE - INTERVAL '10 days',
      'expired', 1, 1, now() - INTERVAL '180 days', now() - INTERVAL '179 days',
      now() - INTERVAL '179 days', NULL, NULL, NULL, v_owner_a),
    (v_agr_terminated, v_shop_b, v_shop_g, NULL, NULL,
      'Accord résilié — Réseau Toulouse', 'Réseau multi-sites',
      'commission', '25% TTC', false, 'none',
      CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE + INTERVAL '60 days',
      'terminated', 1, 1, now() - INTERVAL '120 days', now() - INTERVAL '119 days',
      now() - INTERVAL '119 days', now() - INTERVAL '10 days',
      'Rupture d''un commun accord', NULL, v_owner_b)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO partner_agreement_versions (agreement_id, version_number, snapshot,
      content_hash, change_summary, created_by,
      shop_accepted_at, shop_accepted_by, independent_accepted_at, independent_accepted_by,
      became_active_at)
  SELECT a.id, 1,
    jsonb_build_object(
      'title', a.title, 'scope', a.scope,
      'compensation_model', a.compensation_model,
      'compensation_details', a.compensation_details,
      'requires_exclusivity', a.requires_exclusivity,
      'exclusivity_kind', a.exclusivity_kind,
      'start_date', a.start_date, 'end_date', a.end_date),
    encode(sha256(a.id::text::bytea), 'hex'),
    'Version initiale (seed)',
    a.created_by,
    a.shop_signed_at, CASE WHEN a.shop_signed_at IS NOT NULL THEN a.created_by END,
    a.independent_signed_at, CASE WHEN a.independent_signed_at IS NOT NULL THEN a.created_by END,
    a.became_active_at
  FROM partner_agreements a
  WHERE a.id IN (v_agr_active, v_agr_proposed, v_agr_suspended, v_agr_expired, v_agr_terminated)
  ON CONFLICT (agreement_id, version_number) DO NOTHING;
END $$;