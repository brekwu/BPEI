import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=(file:string)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const m=(file:string)=>get("supabase/migrations/"+file);
const schedule=m("20261029134501_national_partner_availability_appointments_atomic_booking.sql");
const reviews=m("20261029134842_national_verified_customer_feedback_one_time_code_and_moderation.sql");
const reviewsFix=m("20261029135034_national_review_public_attribution_collision_and_withdrawal.sql");
const edge=get("supabase/functions/bpei-customer-review/index.ts");
test("Partner can publish free availability but cannot reserve, edit, or overlap slots",()=>{
 for(const term of ["bpei_partner_availability_slots","ENABLE ROW LEVEL SECURITY",
  "GRANT SELECT,INSERT ON public.bpei_partner_availability_slots TO authenticated",
  "partner_id=(SELECT auth.uid()) AND status='available'",
  "pg_advisory_xact_lock","tstzrange","Availability overlaps an existing slot",
  "bpei_unique_active_appointment_per_mission","bpei_unique_active_appointment_per_slot",
  "bpei_require_partner_level_on_missions"])
  if(term!=="bpei_require_partner_level_on_missions")assert.ok(schedule.includes(term),term);
 assert.doesNotMatch(schedule,/GRANT UPDATE ON public\.bpei_partner_availability_slots TO authenticated/);
});
test("Booking is admin-only, based on accepted mission and current partner authorization",()=>{
 for(const part of ["confirm_partner_appointment","Administrator required",
  "v_request.status<>'accepted'","v_slot.status<>'available'",
  "authorization_state='active'","FOR UPDATE","cancel_partner_appointment",
  "char_length(btrim(coalesce(p_reason,'')))"])
  assert.ok(schedule.includes(part),part);
 assert.match(schedule,/SECURITY INVOKER/);
 assert.match(schedule,/bpei_appointments_private_read/);
});
test("Reviews require actual invoiced completed work, hashed token and explicit customer consent",()=>{
 for(const part of ["bpei_review_invitations","UNIQUE REFERENCES public.independent_requests",
  "token_sha256 text NOT NULL UNIQUE","digest(v_token,'sha256')",
  "r.status='completed'","bpei_service_invoices","21 days",
  "service_role","consumed_at IS NOT NULL","moderation='pending'",
  "customer_public_consent=true","moderate_customer_review",
  "bpei_review_invitation_admin_read","bpei_review_partner_published_read"])
  assert.ok(reviews.includes(part),part);
 for(const part of ["BPEI_REVIEWS_ENABLED","BPEI_REVIEWS_ORIGIN",
  "SHA-256","submit_customer_review","received_pending_moderation",
  "invitation_invalid_used_or_expired"])
  assert.ok(edge.includes(part),part);
 assert.doesNotMatch(edge,/SUPABASE_SERVICE_ROLE_KEY\s*\+\s*payload/);
 assert.ok(get("src/routes/avis-client.tsx").includes("checked={publish}"));
});
test("Public reviews hide tokens and recipient emails, suppress ambiguously named technicians and support takedown",()=>{
 assert.match(reviews,/RETURNS TABLE\(/);
 assert.match(reviews,/rating_mean numeric,rating_count integer/);
 assert.doesNotMatch(reviews,/GRANT SELECT ON public\.bpei_customer_reviews TO anon/);
 assert.match(reviewsFix,/SELECT count\(\*\) FROM public\.independent_profiles/);
 assert.match(reviewsFix,/moderation='published' AND p_decision='rejected'/);
 const publicPage=get("src/routes/trouver-un-technicien.tsx");
 assert.ok(publicPage.includes('rpc("review_summary_for_public"'));
 assert.ok(publicPage.includes("rating_count"));
});
