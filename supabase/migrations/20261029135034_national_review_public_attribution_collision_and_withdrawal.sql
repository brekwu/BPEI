-- Avoid ambiguous public review attribution when two technicians share a professional name/city.
-- Make consent withdrawal and review takedown possible by documented admin decision.
CREATE OR REPLACE FUNCTION bpei_private.review_summary_for_public(
 p_city text,p_postal_code text,p_remote boolean,p_skill text
) RETURNS TABLE(
 display_name text,city text,postal_code text,level smallint,verified_skills text[],
 remote_available boolean,rating_mean numeric,rating_count integer
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN QUERY
 SELECT p.display_name,p.city,p.postal_code,p.level,p.verified_skills,p.remote_available,
  CASE WHEN (
   SELECT count(*) FROM public.independent_profiles x
   WHERE x.display_name=p.display_name AND x.city IS NOT DISTINCT FROM p.city
    AND x.postal_code IS NOT DISTINCT FROM p.postal_code
  )=1 THEN (
   SELECT round(avg(r.rating::numeric),1) FROM public.bpei_customer_reviews r
   JOIN public.independent_profiles x ON x.user_id=r.partner_id
   WHERE x.display_name=p.display_name AND x.city IS NOT DISTINCT FROM p.city
    AND x.postal_code IS NOT DISTINCT FROM p.postal_code
    AND r.moderation='published'
  ) ELSE NULL::numeric END AS rating_mean,
  CASE WHEN (
   SELECT count(*) FROM public.independent_profiles x
   WHERE x.display_name=p.display_name AND x.city IS NOT DISTINCT FROM p.city
    AND x.postal_code IS NOT DISTINCT FROM p.postal_code
  )=1 THEN (
   SELECT count(*)::integer FROM public.bpei_customer_reviews r
   JOIN public.independent_profiles x ON x.user_id=r.partner_id
   WHERE x.display_name=p.display_name AND x.city IS NOT DISTINCT FROM p.city
    AND x.postal_code IS NOT DISTINCT FROM p.postal_code
    AND r.moderation='published'
  ) ELSE 0::integer END AS rating_count
 FROM bpei_private.search_active_partners(p_city,p_postal_code,p_remote,p_skill) p;
END $$;

CREATE OR REPLACE FUNCTION bpei_private.moderate_customer_review(
 p_review_id uuid,p_decision text,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=v_actor)
 THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF p_decision NOT IN ('published','rejected')
 OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 20 AND 500
 THEN RAISE EXCEPTION 'Documented moderation decision required' USING ERRCODE='22023'; END IF;
 UPDATE public.bpei_customer_reviews
 SET moderation=p_decision,moderated_by=v_actor,moderated_at=now(),moderation_note=btrim(p_reason)
 WHERE id=p_review_id AND (moderation='pending'
  OR (moderation='published' AND p_decision='rejected'))
  AND (p_decision='rejected' OR customer_public_consent=true);
 IF NOT FOUND THEN RAISE EXCEPTION 'Review unavailable, consent missing or already decided'
  USING ERRCODE='42501'; END IF;
 RETURN true;
END $$;
