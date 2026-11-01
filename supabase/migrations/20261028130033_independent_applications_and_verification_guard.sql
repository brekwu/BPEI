create table public.independent_applications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 message text not null check (char_length(message) between 10 and 3000),
 status text not null default 'pending' check (status in ('pending','under_review','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 unique(user_id)
);
alter table public.independent_applications enable row level security;
create policy application_select_self on public.independent_applications for select to authenticated using (user_id=(select auth.uid()));
create policy application_insert_self on public.independent_applications for insert to authenticated with check (user_id=(select auth.uid()) and status='pending' and reviewed_at is null);
revoke all on public.independent_applications from anon, authenticated;
grant select,insert (user_id,message) on public.independent_applications to authenticated;
create or replace function public.protect_independent_verification()
returns trigger language plpgsql set search_path = '' as $$
begin
 if new.verified_at is distinct from old.verified_at and current_user not in ('postgres','service_role') then
   raise exception 'Verification is managed by BPEI';
 end if;
 return new;
end $$;
revoke all on function public.protect_independent_verification() from public,anon,authenticated;
create trigger independent_verification_guard before update on public.independent_profiles
for each row execute function public.protect_independent_verification();
