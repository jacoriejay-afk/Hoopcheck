-- Synthetic empty database only. Exercise the installed review-only function.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('fixture.uid', true), '')::uuid
$$;
CREATE TABLE public.player_contact_requests (
  id uuid PRIMARY KEY, requester_id uuid NOT NULL, player_id uuid NOT NULL,
  status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_blocks (blocker_id uuid NOT NULL, blocked_id uuid NOT NULL);
INSERT INTO public.player_contact_requests (id, requester_id, player_id, status) VALUES
 ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'accepted'),
 ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'pending');
