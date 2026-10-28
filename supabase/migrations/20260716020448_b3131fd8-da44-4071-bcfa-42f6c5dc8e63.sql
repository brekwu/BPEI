ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS rating_quality SMALLINT CHECK (rating_quality IS NULL OR rating_quality BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_speed SMALLINT CHECK (rating_speed IS NULL OR rating_speed BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_communication SMALLINT CHECK (rating_communication IS NULL OR rating_communication BETWEEN 1 AND 5);

CREATE OR REPLACE FUNCTION public.submit_review(
  _token TEXT, _author_name TEXT, _rating SMALLINT,
  _title TEXT, _comment TEXT, _ip TEXT DEFAULT NULL, _ua TEXT DEFAULT NULL,
  _rating_quality SMALLINT DEFAULT NULL,
  _rating_speed SMALLINT DEFAULT NULL,
  _rating_communication SMALLINT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tok RECORD; _r RECORD; _rid UUID;
BEGIN
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'rating invalid'; END IF;
  IF _author_name IS NULL OR length(trim(_author_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  SELECT * INTO _tok FROM public.repair_public_tokens WHERE token = _token;
  IF _tok IS NULL OR _tok.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invalid token'; END IF;
  SELECT id, shop_id, customer_id, status INTO _r FROM public.repairs WHERE id = _tok.repair_id;
  IF _r IS NULL THEN RAISE EXCEPTION 'repair not found'; END IF;
  IF _r.status NOT IN ('repair_completed','ready_for_pickup','customer_notified','device_collected') THEN
    RAISE EXCEPTION 'repair not completed yet';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reviews WHERE repair_id = _r.id) THEN RAISE EXCEPTION 'review already submitted'; END IF;
  INSERT INTO public.reviews(shop_id, repair_id, customer_id, author_name, rating, title, comment, status, ip, user_agent,
    rating_quality, rating_speed, rating_communication)
  VALUES (_r.shop_id, _r.id, _r.customer_id, _author_name, _rating, _title, _comment, 'pending', _ip, _ua,
    _rating_quality, _rating_speed, _rating_communication)
  RETURNING id INTO _rid;
  RETURN _rid;
END; $$;

CREATE OR REPLACE FUNCTION public.list_shop_public_reviews(_shop_id UUID, _limit INTEGER DEFAULT 20)
RETURNS TABLE(
  id UUID, author_name TEXT, rating SMALLINT, title TEXT, comment TEXT,
  rating_quality SMALLINT, rating_speed SMALLINT, rating_communication SMALLINT,
  reply_text TEXT, replied_at TIMESTAMPTZ, published_at TIMESTAMPTZ
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, author_name, rating, title, comment,
    rating_quality, rating_speed, rating_communication,
    reply_text, replied_at, published_at
  FROM public.reviews
  WHERE shop_id = _shop_id AND status = 'published'
  ORDER BY published_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(100, COALESCE(_limit, 20)));
$$;
REVOKE ALL ON FUNCTION public.list_shop_public_reviews(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_shop_public_reviews(UUID, INTEGER) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_shop_review_stats(_shop_id UUID)
RETURNS TABLE(review_count INTEGER, avg_rating NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::INTEGER, ROUND(AVG(rating)::NUMERIC, 2)
  FROM public.reviews WHERE shop_id = _shop_id AND status = 'published';
$$;
REVOKE ALL ON FUNCTION public.get_shop_review_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shop_review_stats(UUID) TO anon, authenticated;