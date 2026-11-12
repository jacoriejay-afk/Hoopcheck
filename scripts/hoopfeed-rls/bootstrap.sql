-- Ephemeral PostgreSQL fixtures. No production connection or credentials.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE public.profiles (id uuid PRIMARY KEY, account_type text NOT NULL);
CREATE TABLE public.subscriptions (
  user_id uuid NOT NULL, plan text NOT NULL, status text NOT NULL,
  access_status text, current_period_end timestamptz
);
CREATE TABLE public.feed_posts (
  id uuid PRIMARY KEY, author_id uuid NOT NULL, status text NOT NULL,
  expires_at timestamptz DEFAULT now() + interval '24 hours'
);
CREATE TABLE public.feed_post_checks (post_id uuid NOT NULL, user_id uuid NOT NULL);
CREATE TABLE public.feed_post_comments (
  id uuid PRIMARY KEY, post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.feed_poll_votes (post_id uuid NOT NULL, user_id uuid NOT NULL, option_index integer NOT NULL, PRIMARY KEY(post_id,user_id));
CREATE TABLE public.feed_post_bookmarks (post_id uuid NOT NULL, user_id uuid NOT NULL);
ALTER TABLE public.feed_posts ADD COLUMN post_kind text, ADD COLUMN poll_options jsonb;
ALTER TABLE public.feed_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_bookmarks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_poll_votes, public.feed_post_bookmarks TO authenticated;
CREATE FUNCTION public.get_current_user_admin_role()
RETURNS text LANGUAGE sql STABLE AS $$ SELECT null::text $$;
CREATE FUNCTION public.is_current_user_admin_or_moderator()
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player experience feed read" ON public.feed_posts FOR SELECT TO authenticated USING (false);
CREATE POLICY "player feed checks read" ON public.feed_post_checks FOR SELECT TO authenticated USING (false);
CREATE POLICY "player feed checks insert" ON public.feed_post_checks FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "player feed comments read" ON public.feed_post_comments FOR SELECT TO authenticated USING (false);
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(), public.is_current_user_admin_or_moderator() TO authenticated;
GRANT SELECT ON public.profiles, public.subscriptions, public.feed_posts, public.feed_post_checks, public.feed_post_comments TO authenticated;
GRANT INSERT ON public.feed_post_checks TO authenticated;
INSERT INTO public.profiles VALUES
 ('00000000-0000-0000-0000-000000000001','player'),
 ('00000000-0000-0000-0000-000000000002','fan'),
 ('00000000-0000-0000-0000-000000000003','coach'),
 ('00000000-0000-0000-0000-000000000004','agent'),
 ('00000000-0000-0000-0000-000000000005','scout'),
 ('00000000-0000-0000-0000-000000000006','club_admin'),
 ('00000000-0000-0000-0000-000000000007','fan'),
 ('00000000-0000-0000-0000-000000000008','fan'),
 ('00000000-0000-0000-0000-000000000009','fan'),
 ('00000000-0000-0000-0000-000000000010','fan');
INSERT INTO public.subscriptions VALUES
 ('00000000-0000-0000-0000-000000000001','pro','active','active',null),
 ('00000000-0000-0000-0000-000000000002','premium','active','active',null),
 ('00000000-0000-0000-0000-000000000003','pro','active','active',null),
 ('00000000-0000-0000-0000-000000000004','premium','active','active',null),
 ('00000000-0000-0000-0000-000000000005','pro','active','active',null),
 ('00000000-0000-0000-0000-000000000006','pro','active','active',null),
 ('00000000-0000-0000-0000-000000000007','free','active','active',null),
 ('00000000-0000-0000-0000-000000000008','pro','active','suspended',null),
 ('00000000-0000-0000-0000-000000000009','pro','expired','active',null),
 ('00000000-0000-0000-0000-000000000010','pro','active','active',now()-interval '1 day');
INSERT INTO public.feed_posts(id,author_id,status,expires_at) VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','approved',null),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','pending',null),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','approved',now()-interval '1 year');
UPDATE public.feed_posts SET post_kind='poll', poll_options='["Home","Away"]';
INSERT INTO public.feed_post_comments(id,post_id,author_id,body)
VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Top-level comment');
