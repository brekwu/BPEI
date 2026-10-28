REVOKE ALL ON FUNCTION public.shop_request_publication(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_approve_publication(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_reject_publication(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shop_unpublish(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shop_submit_legal(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_approve_legal(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_reject_legal(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shop_replace_business_hours(uuid, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.shop_request_publication(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_approve_publication(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_reject_publication(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_unpublish(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_submit_legal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_approve_legal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_reject_legal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_replace_business_hours(uuid, jsonb) TO authenticated;