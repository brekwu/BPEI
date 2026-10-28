-- Incident reporting: deployed to BPEI staging on 28 Oct 2026.
-- Aggregation cohorts are based on incident creation date; requires admin role.
CREATE INDEX IF NOT EXISTS bpei_incident_created_status_idx
 ON public.bpei_mission_incidents(created_at DESC,status);

CREATE OR REPLACE FUNCTION public.bpei_admin_incident_statistics(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.independent_admins WHERE user_id=auth.uid()
 ) THEN RAISE EXCEPTION 'BPEI administrator required' USING ERRCODE='42501'; END IF;
 IF p_days IS NULL OR p_days NOT IN(7,30,90) THEN
   RAISE EXCEPTION 'Invalid statistics period' USING ERRCODE='22023'; END IF;
 WITH selected AS MATERIALIZED(
   SELECT status,priority,assigned_admin_id,target_at,created_at,reviewed_at
   FROM public.bpei_mission_incidents
   WHERE created_at>=now()-make_interval(days=>p_days) AND created_at<=now()
 ), totals AS(
   SELECT
   count(*)::integer total,
   count(*) FILTER(WHERE status='open')::integer open,
   count(*) FILTER(WHERE status='under_review')::integer under_review,
   count(*) FILTER(WHERE status='resolved')::integer resolved,
   count(*) FILTER(WHERE status<>'resolved' AND assigned_admin_id IS NULL)::integer unassigned,
   count(*) FILTER(WHERE status<>'resolved' AND target_at<now())::integer overdue,
   count(*) FILTER(WHERE status<>'resolved' AND priority='critical')::integer critical_active,
   count(*) FILTER(WHERE priority='low')::integer low,
   count(*) FILTER(WHERE priority='normal')::integer normal,
   count(*) FILTER(WHERE priority='high')::integer high,
   count(*) FILTER(WHERE priority='critical')::integer critical,
   round((avg(extract(epoch FROM (reviewed_at-created_at))/3600)
    FILTER(WHERE status='resolved' AND reviewed_at>=created_at))::numeric,1)
    AS average_resolution_hours
   FROM selected
 )
 SELECT jsonb_build_object(
 'period_days',p_days,'calculated_at',now(),'total',total,'open',open,
 'under_review',under_review,'resolved',resolved,'unassigned',unassigned,
 'overdue',overdue,'critical_active',critical_active,'low',low,'normal',normal,
 'high',high,'critical',critical,'average_resolution_hours',average_resolution_hours
 ) INTO v_result FROM totals;
 RETURN v_result;
END $function$
;
REVOKE ALL ON FUNCTION public.bpei_admin_incident_statistics(integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bpei_admin_incident_statistics(integer) TO authenticated;
