CREATE TYPE public.bug_report_status AS ENUM ('new','in_progress','resolved','wont_fix');
CREATE TYPE public.bug_report_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE public.bug_report_category AS ENUM ('bug','idea','ux','performance','other');

CREATE TABLE public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name text,
  reporter_email text,
  category public.bug_report_category NOT NULL DEFAULT 'bug',
  severity public.bug_report_severity NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text NOT NULL,
  page_url text,
  user_agent text,
  status public.bug_report_status NOT NULL DEFAULT 'new',
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bug_reports_title_len CHECK (char_length(title) BETWEEN 3 AND 200),
  CONSTRAINT bug_reports_desc_len CHECK (char_length(description) BETWEEN 5 AND 5000)
);

GRANT SELECT, INSERT, UPDATE ON public.bug_reports TO authenticated;
GRANT INSERT ON public.bug_reports TO anon;
GRANT ALL ON public.bug_reports TO service_role;

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bug_reports_insert_anyone" ON public.bug_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (submitted_by IS NULL OR submitted_by = auth.uid());

CREATE POLICY "bug_reports_select_own" ON public.bug_reports
  FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR public.is_admin_bpei(auth.uid()));

CREATE POLICY "bug_reports_admin_all" ON public.bug_reports
  FOR ALL TO authenticated
  USING (public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.is_admin_bpei(auth.uid()));

CREATE INDEX bug_reports_status_idx ON public.bug_reports(status, created_at DESC);

CREATE TRIGGER bug_reports_set_updated_at BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.admin_seed_demo_shop()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shop uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_admin_bpei(v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.shops (
    name, legal_name, legal_form, siret, vat_number,
    address, city, postal_code, phone, email, website,
    description, status, owner_user_id, validated_at
  ) VALUES (
    'InfoRepair Démo', 'INFOREPAIR DÉMO SAS', 'SAS', '12345678900011', 'FR12123456789',
    '10 rue de la Démo', 'Paris', '75011', '01 23 45 67 89',
    'demo@bpei.fr', 'https://demo.bpei.fr',
    'Boutique de démonstration BPEI — réparation informatique, dépannage à domicile, vente de pièces reconditionnées.',
    'validated', v_uid, now()
  ) RETURNING id INTO v_shop;

  INSERT INTO public.service_catalog (shop_id, name, description, category, line_type, unit, unit_price_cents, tax_rate, estimated_duration_minutes, default_quantity)
  VALUES
    (v_shop, 'Diagnostic complet', 'Analyse matérielle + logicielle', 'Diagnostic', 'service', 'unité', 4900, 20, 30, 1),
    (v_shop, 'Remplacement écran laptop 15"', 'Écran neuf compatible + pose', 'Réparation', 'service', 'unité', 18900, 20, 60, 1),
    (v_shop, 'Nettoyage & pâte thermique', 'Démontage, dépoussiérage, réfection pâte thermique', 'Entretien', 'service', 'unité', 6900, 20, 45, 1),
    (v_shop, 'Récupération de données', 'Extraction sur support fonctionnel', 'Data', 'service', 'unité', 12900, 20, 90, 1);

  INSERT INTO public.stock_items (shop_id, name, item_type, unit, cost_price_cents, sell_price_cents, tax_rate, quantity, min_threshold)
  VALUES
    (v_shop, 'SSD NVMe 500 Go reconditionné', 'part', 'unité', 2500, 5900, 20, 12, 2),
    (v_shop, 'Barrette RAM DDR4 8 Go', 'part', 'unité', 1800, 3900, 20, 20, 3),
    (v_shop, 'Batterie universelle laptop 50 Wh', 'part', 'unité', 3400, 7900, 20, 6, 2),
    (v_shop, 'Chargeur USB-C 65 W', 'part', 'unité', 1200, 2900, 20, 30, 5);

  INSERT INTO public.reviews (shop_id, author_name, rating, title, comment, status, published_at, rating_quality, rating_speed, rating_communication)
  VALUES
    (v_shop, 'Marie L.', 5, 'Rapide et pro', 'Écran remplacé en 24h, tarif clair. Je recommande.', 'published', now() - interval '3 days', 5, 5, 5),
    (v_shop, 'Julien B.', 4, 'Bon accueil', 'Diagnostic honnête, on m''a évité un remplacement inutile.', 'published', now() - interval '10 days', 4, 4, 5),
    (v_shop, 'Sophie D.', 5, 'Sauvés !', 'Récupération de mes photos après une chute du disque. Merci !', 'published', now() - interval '20 days', 5, 4, 5);

  RETURN v_shop;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_seed_demo_shop() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_seed_demo_shop() TO authenticated;