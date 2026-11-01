revoke update on public.independent_requests from authenticated;
drop policy if exists independent_request_update_self on public.independent_requests;
revoke update on public.independent_profiles from authenticated;
grant update (display_name,business_name,siret,city,postal_code,service_radius_km,skills,bio) on public.independent_profiles to authenticated;
