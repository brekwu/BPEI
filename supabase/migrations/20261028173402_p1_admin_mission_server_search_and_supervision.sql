-- Applied to BPEI Supabase on 2026-10-28: version 20261028173402.
-- Admin-only, read-only mission search with pagination and alert prioritization.
CREATE OR REPLACE FUNCTION public.bpei_admin_search_missions(p_query text DEFAULT ''::text, p_status text DEFAULT 'all'::text, p_attention text DEFAULT 'all'::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
 v_uid uuid := auth.uid();
 v_search text := lower(btrim(coalesce(p_query,'')));
 v_result jsonb;
BEGIN
 IF v_uid IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.independent_admins ad WHERE ad.user_id=v_uid
 ) THEN
  RAISE EXCEPTION 'BPEI administration required' USING ERRCODE='42501';
 END IF;
 IF char_length(v_search)>120 OR p_limit IS NULL OR p_limit<1 OR p_limit>50
    OR p_offset IS NULL OR p_offset<0 OR p_offset>10000
    OR coalesce(p_status,'') NOT IN ('all','new','accepted','in_progress','completed','cancelled')
    OR coalesce(p_attention,'') NOT IN ('all','needs_attention')
 THEN
  RAISE EXCEPTION 'Invalid BPEI mission search parameters' USING ERRCODE='22023';
 END IF;
 WITH base AS MATERIALIZED (
  SELECT
   r.id,r.title,r.status,r.created_at,r.updated_at,r.scheduled_at,
   r.independent_id,r.inquiry_id,
   p.display_name AS technician_name,p.city AS technician_city,
   coalesce(inc.open_count,0)::integer AS active_incidents,
   CASE
    WHEN coalesce(inc.open_count,0)>0 THEN 'incident_open'
    WHEN r.status IN ('new','accepted','in_progress')
      AND r.scheduled_at IS NOT NULL AND r.scheduled_at < now() THEN 'overdue'
    WHEN r.status='new' AND r.created_at < now()-interval '24 hours' THEN 'awaiting_reply'
    ELSE NULL
   END AS attention_reason
  FROM public.independent_requests r
  LEFT JOIN public.independent_profiles p ON p.user_id=r.independent_id
  LEFT JOIN (
    SELECT request_id,count(*) AS open_count
    FROM public.bpei_mission_incidents
    WHERE status IN ('open','under_review')
    GROUP BY request_id
  ) inc ON inc.request_id=r.id
  WHERE v_search='' OR strpos(lower(r.title),v_search)>0
      OR strpos(lower(coalesce(p.display_name,'')),v_search)>0
 ),
 selected AS MATERIALIZED (
  SELECT * FROM base
  WHERE (p_status='all' OR status=p_status)
   AND (p_attention='all' OR attention_reason IS NOT NULL)
 ),
 page AS (
  SELECT * FROM selected ORDER BY created_at DESC,id DESC LIMIT p_limit OFFSET p_offset
 ),
 summary AS (
  SELECT count(*)::integer AS all_count,
   count(*) FILTER (WHERE status='new')::integer AS new_count,
   count(*) FILTER (WHERE status='accepted')::integer AS accepted_count,
   count(*) FILTER (WHERE status='in_progress')::integer AS in_progress_count,
   count(*) FILTER (WHERE status='completed')::integer AS completed_count,
   count(*) FILTER (WHERE status='cancelled')::integer AS cancelled_count,
   count(*) FILTER (WHERE attention_reason IS NOT NULL)::integer AS attention_count
  FROM base
 )
 SELECT jsonb_build_object(
  'total',(SELECT count(*)::integer FROM selected),
  'items',(SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY page.created_at DESC,page.id DESC),'[]'::jsonb) FROM page),
  'summary',(SELECT to_jsonb(summary) FROM summary)
 ) INTO v_result;
 RETURN v_result;
END;
$function$
;
REVOKE ALL ON FUNCTION public.bpei_admin_search_missions(text,text,text,integer,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bpei_admin_search_missions(text,text,text,integer,integer)
 TO authenticated;
CREATE INDEX IF NOT EXISTS bpei_requests_admin_sort_idx
 ON public.independent_requests (created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS bpei_requests_admin_status_sort_idx
 ON public.independent_requests (status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS bpei_incidents_open_by_request_idx
 ON public.bpei_mission_incidents (request_id)
 WHERE status IN ('open','under_review');
