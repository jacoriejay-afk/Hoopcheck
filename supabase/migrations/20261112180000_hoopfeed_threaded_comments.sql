BEGIN;

ALTER TABLE public.feed_post_comments
  ADD COLUMN parent_id uuid,
  ADD CONSTRAINT feed_post_comments_id_post_unique UNIQUE (id, post_id),
  ADD CONSTRAINT feed_post_comments_reply_parent
    FOREIGN KEY (parent_id, post_id) REFERENCES public.feed_post_comments (id, post_id)
    ON DELETE SET NULL (parent_id);

CREATE INDEX feed_post_comments_parent_idx
  ON public.feed_post_comments (parent_id, post_id) WHERE parent_id IS NOT NULL;

CREATE FUNCTION public.hoopfeed_validate_comment_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- The only supported link change is detaching a reply when its parent is deleted.
    IF NEW.post_id IS DISTINCT FROM OLD.post_id
       OR (NEW.parent_id IS NOT NULL AND NEW.parent_id IS DISTINCT FROM OLD.parent_id) THEN
      RAISE EXCEPTION 'A comment cannot be moved or reparented';
    END IF;
  ELSIF NEW.parent_id IS NOT NULL AND (
    NEW.parent_id = NEW.id OR NOT EXISTS (
      SELECT 1 FROM public.feed_post_comments c
      WHERE c.id = NEW.parent_id AND c.post_id = NEW.post_id
    )
  ) THEN
    RAISE EXCEPTION 'Reply parent must already exist in the same post';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.hoopfeed_validate_comment_parent() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER hoopfeed_comment_parent_guard
BEFORE INSERT OR UPDATE OF parent_id, post_id ON public.feed_post_comments
FOR EACH ROW EXECUTE FUNCTION public.hoopfeed_validate_comment_parent();

COMMIT;
