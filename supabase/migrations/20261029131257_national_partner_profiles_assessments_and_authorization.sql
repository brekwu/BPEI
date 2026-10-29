-- BPEI network foundation. Preserve old verified-professional flows.
ALTER TABLE public.independent_profiles
 ADD COLUMN training_details text NOT NULL DEFAULT '' CHECK(char_length(training_details)<=2000),
 ADD COLUMN experience_years smallint CHECK(experience_years BETWEEN 0 AND 70),
 ADD COLUMN remote_available boolean NOT NULL DEFAULT false,
 ADD COLUMN availability_notes text NOT NULL DEFAULT '' CHECK(char_length(availability_notes)<=800),
 ADD COLUMN mission_types text[] NOT NULL DEFAULT '{}'::text[] CHECK(cardinality(mission_types)<=20),
 ADD COLUMN professional_stage text NOT NULL DEFAULT 'preparing'
  CHECK(professional_stage IN ('preparing','registered'));
CREATE TABLE public.bpei_technician_levels(
 user_id uuid PRIMARY KEY REFERENCES public.independent_profiles(user_id) ON DELETE CASCADE,
 level smallint CHECK(level BETWEEN 1 AND 4),
 authorization_state text NOT NULL DEFAULT 'candidate'
  CHECK(authorization_state IN ('candidate','active','suspended')),
 decision_note text NOT NULL DEFAULT '' CHECK(char_length(decision_note)<=2000),
 last_assessed_at timestamptz,
 authorized_by uuid REFERENCES auth.users(id),
 authorized_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(authorization_state<>'active' OR (level IS NOT NULL AND authorized_by IS NOT NULL AND authorized_at IS NOT NULL))
);
CREATE INDEX bpei_levels_state_idx ON public.bpei_technician_levels(authorization_state,level);
ALTER TABLE public.bpei_technician_levels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_technician_levels FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_technician_levels TO authenticated;
CREATE POLICY bpei_levels_private_read ON public.bpei_technician_levels
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR EXISTS(
 SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid())
));
CREATE TABLE public.bpei_assessment_questions(
 level smallint NOT NULL CHECK(level BETWEEN 1 AND 4),
 ordinal smallint NOT NULL CHECK(ordinal BETWEEN 1 AND 25),
 domain text NOT NULL CHECK(char_length(domain) BETWEEN 2 AND 100),
 question text NOT NULL CHECK(char_length(question) BETWEEN 15 AND 450),
 evaluator_answer text NOT NULL CHECK(char_length(evaluator_answer) BETWEEN 15 AND 800),
 PRIMARY KEY(level,ordinal)
);
ALTER TABLE public.bpei_assessment_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_assessment_questions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_assessment_questions TO authenticated;
CREATE POLICY bpei_assessment_questions_admin_read ON public.bpei_assessment_questions
 FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid())
));
CREATE TABLE public.bpei_technician_assessments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE CASCADE,
 evaluator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 tested_level smallint NOT NULL CHECK(tested_level BETWEEN 1 AND 4),
 knowledge_score smallint NOT NULL CHECK(knowledge_score BETWEEN 0 AND 25),
 practical_score smallint NOT NULL CHECK(practical_score BETWEEN 0 AND 20),
 interview_score smallint NOT NULL CHECK(interview_score BETWEEN 0 AND 10),
 method text NOT NULL CHECK(method IN ('written_practical_video','oral_practical_video','in_person')),
 evidence_reference text NOT NULL CHECK(char_length(btrim(evidence_reference)) BETWEEN 20 AND 500),
 decision text NOT NULL CHECK(decision IN ('qualified','not_qualified')),
 summary text NOT NULL CHECK(char_length(btrim(summary)) BETWEEN 40 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bpei_assessments_subject_idx ON public.bpei_technician_assessments(user_id,created_at DESC);
CREATE INDEX bpei_assessments_evaluator_idx ON public.bpei_technician_assessments(evaluator_id);
ALTER TABLE public.bpei_technician_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_technician_assessments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_technician_assessments TO authenticated;
CREATE POLICY bpei_assessment_summary_private ON public.bpei_technician_assessments
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR EXISTS(
 SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid())
));
CREATE OR REPLACE FUNCTION bpei_private.record_partner_assessment(
 p_user_id uuid,p_tested_level integer,p_knowledge_score integer,p_practical_score integer,
 p_interview_score integer,p_method text,p_evidence_reference text,p_decision text,p_summary text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());v_id uuid;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_actor)
 THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.independent_profiles WHERE user_id=p_user_id)
 THEN RAISE EXCEPTION 'Candidate profile required' USING ERRCODE='22023'; END IF;
 IF p_tested_level NOT BETWEEN 1 AND 4 OR p_knowledge_score NOT BETWEEN 0 AND 25
 OR p_practical_score NOT BETWEEN 0 AND 20 OR p_interview_score NOT BETWEEN 0 AND 10
 OR p_method NOT IN ('written_practical_video','oral_practical_video','in_person')
 OR p_decision NOT IN ('qualified','not_qualified')
 OR char_length(btrim(coalesce(p_evidence_reference,''))) NOT BETWEEN 20 AND 500
 OR char_length(btrim(coalesce(p_summary,''))) NOT BETWEEN 40 AND 2000
 THEN RAISE EXCEPTION 'Complete evidence-backed assessment required' USING ERRCODE='22023'; END IF;
 IF p_decision='qualified' AND (p_knowledge_score<12 OR p_practical_score<10 OR p_interview_score<4)
 THEN RAISE EXCEPTION 'Component passing thresholds not met' USING ERRCODE='22023'; END IF;
 INSERT INTO public.bpei_technician_assessments(
  user_id,evaluator_id,tested_level,knowledge_score,practical_score,interview_score,
  method,evidence_reference,decision,summary
 ) VALUES(p_user_id,v_actor,p_tested_level,p_knowledge_score,p_practical_score,p_interview_score,
  p_method,btrim(p_evidence_reference),p_decision,btrim(p_summary)) RETURNING id INTO v_id;
 IF p_decision='qualified' THEN
  INSERT INTO public.bpei_technician_levels(user_id,level,authorization_state,decision_note,last_assessed_at)
  VALUES(p_user_id,p_tested_level,'candidate',btrim(p_summary),now())
  ON CONFLICT(user_id) DO UPDATE SET
   level=EXCLUDED.level,
   authorization_state=CASE WHEN bpei_technician_levels.authorization_state='active'
     THEN 'active' ELSE bpei_technician_levels.authorization_state END,
   decision_note=EXCLUDED.decision_note,last_assessed_at=EXCLUDED.last_assessed_at,updated_at=now();
 END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION bpei_private.record_partner_assessment(uuid,integer,integer,integer,integer,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.record_partner_assessment(uuid,integer,integer,integer,integer,text,text,text,text)
 TO authenticated;
CREATE FUNCTION public.record_partner_assessment(
 p_user_id uuid,p_tested_level integer,p_knowledge_score integer,p_practical_score integer,
 p_interview_score integer,p_method text,p_evidence_reference text,p_decision text,p_summary text
) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.record_partner_assessment($1,$2,$3,$4,$5,$6,$7,$8,$9)
$$;
REVOKE ALL ON FUNCTION public.record_partner_assessment(uuid,integer,integer,integer,integer,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_partner_assessment(uuid,integer,integer,integer,integer,text,text,text,text)
 TO authenticated;
CREATE OR REPLACE FUNCTION bpei_private.set_partner_authorization(
 p_user_id uuid,p_action text,p_reason text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());v_level public.bpei_technician_levels%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_actor)
 THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF p_action NOT IN ('activate','suspend') OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 30 AND 2000
 THEN RAISE EXCEPTION 'Documented authorization decision required' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_level FROM public.bpei_technician_levels
 WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND OR v_level.level IS NULL THEN
  RAISE EXCEPTION 'Prior skills evaluation required' USING ERRCODE='22023'; END IF;
 IF p_action='activate' THEN
  IF NOT EXISTS(
   SELECT 1 FROM public.independent_profiles p
   JOIN public.independent_applications a ON a.user_id=p.user_id AND a.status='approved'
   JOIN public.independent_verification_checks v ON v.user_id=p.user_id
    AND v.siret=p.siret AND v.enterprise_active IS TRUE AND v.establishment_active IS TRUE
    AND v.identity_confirmed IS TRUE AND v.insurance_confirmed IS TRUE
    AND v.insurance_expires_on>=current_date AND v.checked_at>=now()-interval '30 days'
   JOIN public.bpei_launch_controls c ON c.id=true AND c.legal_documents_published=true
   JOIN public.bpei_legal_acceptances acc ON acc.user_id=p.user_id AND acc.legal_version=c.legal_version
   WHERE p.user_id=p_user_id AND p.verified_at IS NOT NULL AND p.siret ~ '^[0-9]{14}$'
  ) THEN RAISE EXCEPTION 'Registered, insured and approved professional with current terms required'
   USING ERRCODE='22023'; END IF;
 END IF;
 UPDATE public.bpei_technician_levels SET authorization_state=
  CASE WHEN p_action='activate' THEN 'active' ELSE 'suspended' END,
  authorized_by=v_actor,authorized_at=now(),decision_note=btrim(p_reason),updated_at=now()
 WHERE user_id=p_user_id;
 RETURN p_action;
END $$;
REVOKE ALL ON FUNCTION bpei_private.set_partner_authorization(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.set_partner_authorization(uuid,text,text) TO authenticated;
CREATE FUNCTION public.set_partner_authorization(p_user_id uuid,p_action text,p_reason text)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.set_partner_authorization($1,$2,$3)
$$;
REVOKE ALL ON FUNCTION public.set_partner_authorization(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_partner_authorization(uuid,text,text) TO authenticated;
CREATE FUNCTION bpei_private.require_activated_partner_on_assignment()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.inquiry_id IS NOT NULL AND
  (TG_OP='INSERT' OR (TG_OP='UPDATE' AND NEW.status IN ('accepted','in_progress')
     AND OLD.status IS DISTINCT FROM NEW.status)) AND
  NOT EXISTS(SELECT 1 FROM public.bpei_technician_levels t
   WHERE t.user_id=NEW.independent_id AND t.authorization_state='active'
     AND t.level BETWEEN 1 AND 4)
 THEN RAISE EXCEPTION 'A qualified active BPEI partner is required for a paid intervention'
  USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bpei_private.require_activated_partner_on_assignment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_require_partner_level_on_missions
 BEFORE INSERT OR UPDATE ON public.independent_requests
 FOR EACH ROW EXECUTE FUNCTION bpei_private.require_activated_partner_on_assignment();
