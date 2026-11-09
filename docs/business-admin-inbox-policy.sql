-- REVIEW BEFORE APPLYING: existing table only, no new table.
-- Grants alone do not allow reads while RLS is enabled.
-- Only users with a verified admin role can view inquiry records.
create policy "sponsor inquiries admin read"
on public.sponsor_inquiries
for select to authenticated
using ((select public.get_current_user_admin_role()) = 'admin');
-- The policy above is NOT applied by committing this file.
-- Review role function permissions and test authenticated non-admin denial.
