-- BPEI P1: add covering B-tree indexes for six foreign-key columns.
-- No launch gates, RLS policies, user records, or API grants are modified.
-- See Supabase advisor 0001_unindexed_foreign_keys.
create index if not exists bpei_incident_events_actor_id_idx
  on public.bpei_incident_events(actor_id);

create index if not exists bpei_mission_events_actor_id_idx
  on public.bpei_mission_events(actor_id);

create index if not exists bpei_mission_incidents_reporter_id_idx
  on public.bpei_mission_incidents(reporter_id);

create index if not exists bpei_mission_incidents_reviewed_by_idx
  on public.bpei_mission_incidents(reviewed_by);

create index if not exists bpei_notifications_incident_id_idx
  on public.bpei_notifications(incident_id);

create index if not exists bpei_notifications_mission_id_idx
  on public.bpei_notifications(mission_id);
