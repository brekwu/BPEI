alter table public.import_jobs
  add column if not exists bpei_assistance_status text not null default 'none'
    check (bpei_assistance_status in ('none','requested','in_progress','resolved')),
  add column if not exists bpei_assistance_requested_at timestamptz,
  add column if not exists bpei_assignee_user_id uuid references auth.users(id) on delete set null,
  add column if not exists bpei_notes text;

create index if not exists import_jobs_bpei_assistance_idx
  on public.import_jobs (bpei_assistance_status)
  where bpei_assistance_status <> 'none';

create table if not exists public.import_row_notes (
  id uuid primary key default gen_random_uuid(),
  row_id uuid not null references public.import_rows(id) on delete cascade,
  job_id uuid not null references public.import_jobs(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('bpei','shop')),
  note text not null,
  suggested jsonb,
  created_at timestamptz not null default now()
);

create index if not exists import_row_notes_row_idx on public.import_row_notes(row_id);
create index if not exists import_row_notes_job_idx on public.import_row_notes(job_id);

grant select, insert, update, delete on public.import_row_notes to authenticated;
grant all on public.import_row_notes to service_role;

alter table public.import_row_notes enable row level security;

drop policy if exists import_row_notes_shop_read on public.import_row_notes;
create policy import_row_notes_shop_read on public.import_row_notes
  for select to authenticated
  using (public.is_shop_member(auth.uid(), shop_id));

drop policy if exists import_row_notes_bpei_all on public.import_row_notes;
create policy import_row_notes_bpei_all on public.import_row_notes
  for all to authenticated
  using (public.is_admin_bpei(auth.uid()) or public.is_owner_bpei(auth.uid()))
  with check (public.is_admin_bpei(auth.uid()) or public.is_owner_bpei(auth.uid()));

drop policy if exists import_row_notes_shop_write on public.import_row_notes;
create policy import_row_notes_shop_write on public.import_row_notes
  for insert to authenticated
  with check (
    public.is_shop_member(auth.uid(), shop_id)
    and author_role = 'shop'
    and author_user_id = auth.uid()
  );

drop policy if exists import_jobs_bpei_read on public.import_jobs;
create policy import_jobs_bpei_read on public.import_jobs
  for select to authenticated
  using (public.is_admin_bpei(auth.uid()) or public.is_owner_bpei(auth.uid()));

drop policy if exists import_jobs_bpei_update on public.import_jobs;
create policy import_jobs_bpei_update on public.import_jobs
  for update to authenticated
  using (public.is_admin_bpei(auth.uid()) or public.is_owner_bpei(auth.uid()))
  with check (public.is_admin_bpei(auth.uid()) or public.is_owner_bpei(auth.uid()));

drop policy if exists import_rows_bpei_read on public.import_rows;
create policy import_rows_bpei_read on public.import_rows
  for select to authenticated
  using (public.is_admin_bpei(auth.uid()) or public.is_owner_bpei(auth.uid()));