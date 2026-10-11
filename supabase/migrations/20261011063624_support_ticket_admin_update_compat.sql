-- Preserve the existing admin queue UI while removing ticket-owner self-updates.
GRANT UPDATE ON TABLE public.support_tickets TO authenticated;
DROP POLICY IF EXISTS "support ticket admin update" ON public.support_tickets;
CREATE POLICY "support ticket admin update" ON public.support_tickets
FOR UPDATE TO authenticated
USING ((SELECT public.is_current_user_admin_or_moderator()))
WITH CHECK ((SELECT public.is_current_user_admin_or_moderator()));
