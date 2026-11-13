-- SHARE-1: private, reference-only HoopFeed inbox. No private post text or media copied.
CREATE TABLE IF NOT EXISTS public.hoopfeed_post_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hoopfeed_post_shares_not_self CHECK (sender_id <> recipient_id),
  CONSTRAINT hoopfeed_post_shares_unique UNIQUE (post_id, sender_id, recipient_id)
);
CREATE INDEX IF NOT EXISTS hoopfeed_post_shares_recipient_idx
  ON public.hoopfeed_post_shares (recipient_id, created_at DESC);
ALTER TABLE public.hoopfeed_post_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hoopfeed_post_shares FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.hoopfeed_post_shares TO authenticated;
-- A share reference is visible only to its recipient and only while the parent
-- post is approved, unexpired and visible under the existing feed_posts RLS.
CREATE POLICY "hoopfeed shares recipient read"
  ON public.hoopfeed_post_shares FOR SELECT TO authenticated
  USING (
    recipient_id = (SELECT auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = recipient_id AND b.blocked_id = sender_id)
         OR (b.blocker_id = sender_id AND b.blocked_id = recipient_id)
    )
    AND EXISTS (
      SELECT 1 FROM public.feed_posts fp
      WHERE fp.id = post_id
        AND fp.status = 'approved'
        AND (fp.expires_at IS NULL OR fp.expires_at > now())
    )
  );
-- No direct INSERT/UPDATE/DELETE grant or policy. A separately reviewed
-- authenticated server endpoint must enforce recipient eligibility, blocks,
-- post access, rate limits and idempotency before inserting a share.
