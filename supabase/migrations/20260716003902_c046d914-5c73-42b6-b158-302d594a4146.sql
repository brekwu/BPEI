-- ============ ENUMS ============
CREATE TYPE public.shop_status AS ENUM ('draft','pending','under_review','validated','rejected','suspended');
CREATE TYPE public.shop_role AS ENUM ('employee','technician','shop_manager','network_owner');
CREATE TYPE public.platform_role AS ENUM ('client','admin_bpei');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============ PLATFORM ROLES ============
CREATE TABLE public.user_platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.platform_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_platform_roles TO authenticated;
GRANT ALL ON public.user_platform_roles TO service_role;
ALTER TABLE public.user_platform_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_roles_self_select" ON public.user_platform_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Security-definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_platform_role(_user uuid, _role public.platform_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_platform_roles WHERE user_id = _user AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_admin_bpei(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_platform_role(_user, 'admin_bpei') $$;

-- Admin visibility on platform roles
CREATE POLICY "platform_roles_admin_all" ON public.user_platform_roles FOR ALL TO authenticated
  USING (public.is_admin_bpei(auth.uid())) WITH CHECK (public.is_admin_bpei(auth.uid()));

-- ============ SHOPS ============
CREATE TABLE public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  legal_form text,
  siren text,
  siret text,
  vat_number text,
  address text,
  city text,
  postal_code text,
  phone text,
  email text,
  website text,
  description text,
  status public.shop_status NOT NULL DEFAULT 'pending',
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- ============ SHOP MEMBERSHIPS ============
CREATE TABLE public.shop_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.shop_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_memberships TO authenticated;
GRANT ALL ON public.shop_memberships TO service_role;
ALTER TABLE public.shop_memberships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_shop_member(_user uuid, _shop uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.shop_memberships WHERE user_id = _user AND shop_id = _shop) $$;

CREATE OR REPLACE FUNCTION public.has_shop_role(_user uuid, _shop uuid, _role public.shop_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.shop_memberships WHERE user_id = _user AND shop_id = _shop AND role = _role) $$;

-- SHOPS policies
CREATE POLICY "shops_owner_select" ON public.shops FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_shop_member(auth.uid(), id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "shops_owner_insert" ON public.shops FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "shops_owner_update" ON public.shops FOR UPDATE TO authenticated
  USING ((owner_user_id = auth.uid() AND status IN ('draft','pending')) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK ((owner_user_id = auth.uid()) OR public.is_admin_bpei(auth.uid()));
-- Public listing of validated shops (name/city only via view — full row still gated)
CREATE POLICY "shops_public_validated_select" ON public.shops FOR SELECT TO anon
  USING (status = 'validated');
GRANT SELECT ON public.shops TO anon;

-- MEMBERSHIPS policies
CREATE POLICY "memberships_self_select" ON public.shop_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_bpei(auth.uid())
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_user_id = auth.uid()));
CREATE POLICY "memberships_owner_manage" ON public.shop_memberships FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_user_id = auth.uid()) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_user_id = auth.uid()) OR public.is_admin_bpei(auth.uid()));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_shops_updated BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default 'client' platform role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_platform_roles (user_id, role) VALUES (NEW.id, 'client')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();