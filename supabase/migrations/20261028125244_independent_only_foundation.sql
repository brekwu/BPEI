create table public.independent_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (length(trim(display_name)) between 2 and 120),
 business_name text, siret text,
 city text, postal_code text, service_radius_km integer check (service_radius_km between 0 and 500),
 skills text[] not null default '{}',
 bio text,
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.independent_requests (
 id uuid primary key default gen_random_uuid(),
 independent_id uuid not null references public.independent_profiles(user_id),
 title text not null check (length(trim(title)) between 3 and 200),
 description text,
 status text not null default 'new' check (status in ('new','accepted','in_progress','completed','cancelled')),
 scheduled_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index independent_requests_independent_id_idx on public.independent_requests(independent_id);
alter table public.independent_profiles enable row level security;
alter table public.independent_requests enable row level security;
create policy independent_profile_read_self on public.independent_profiles for select to authenticated using ((select auth.uid())=user_id);
create policy independent_profile_insert_self on public.independent_profiles for insert to authenticated with check ((select auth.uid())=user_id and verified_at is null);
create policy independent_profile_update_self on public.independent_profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy independent_request_read_self on public.independent_requests for select to authenticated using ((select auth.uid())=independent_id);
create policy independent_request_update_self on public.independent_requests for update to authenticated using ((select auth.uid())=independent_id) with check ((select auth.uid())=independent_id);
revoke all on public.independent_profiles,public.independent_requests from anon;
grant select,insert,update on public.independent_profiles to authenticated;
grant select,update on public.independent_requests to authenticated;
revoke update(verified_at) on public.independent_profiles from authenticated;
