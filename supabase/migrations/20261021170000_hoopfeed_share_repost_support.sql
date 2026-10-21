ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS shared_post_id uuid NULL
  REFERENCES public.feed_posts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS feed_posts_shared_post_id_idx
  ON public.feed_posts(shared_post_id)
  WHERE shared_post_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
