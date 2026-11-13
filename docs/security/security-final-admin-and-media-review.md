# SECURITY-FINAL — admin membership authorization and legacy media

## Verified production behavior (read-only, 2026-11-12)

`public.admin_set_membership(uuid,text)` is SECURITY DEFINER, search_path public, and calls `public.is_current_user_admin_or_moderator()` for authorization. It can create/update local `pro` or `premium` subscriptions with a one-year period, or mark local membership free. It explicitly refuses changes when a nonblank Stripe subscription ID exists.

**Risk:** moderators can grant local paid membership. Confirm product policy that only actual administrators may grant paid tiers. This is not a demonstrated anonymous escalation; the function checks signed-in privileges.

## Proposed admin-only replacement (review; NOT executed)

Preserve the existing function body and Stripe guard, but replace its authorization preamble with a check against the actual `admin_roles` record:

```sql
-- Within public.admin_set_membership(p_user_id uuid, p_plan text),
-- replace the current moderator-or-admin permission check with:
IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.admin_roles ar
  WHERE ar.user_id = (SELECT auth.uid()) AND ar.role = 'admin'
) THEN
  RAISE EXCEPTION 'Admin access required';
END IF;
```

Review the real `admin_roles` column names and the caller route before generating an executable CREATE OR REPLACE FUNCTION migration. Keep SECURITY DEFINER search_path hardened (prefer explicit schema qualification and search_path='') and avoid changing billing behavior.

## Media migration gate

Production currently has 7 objects in public `feed-images`. The `feed-videos` bucket is also public. Private `hoopfeed-private-images` and `hoopfeed-private-videos` buckets exist. Never toggle public bucket visibility without checking all references.

1. Inventory public object references in feed_posts and any other user-facing entities. Do not log user IDs, object keys or private URLs to GitHub.
2. Confirm signed URL / authenticated proxy handling for all roles and blocked viewers.
3. Copy legacy media to private buckets, verify bytes and authorization, atomically switch references, retain rollback until validated.
4. Remove old public objects only after approved verification; public CDN cache may remain temporarily.
5. Review direct uploads to public buckets and remove unsafe upload paths only when new private uploaders work.

## Required test matrix

Admin can change non-Stripe local membership; moderator, ordinary paid user and anonymous cannot. Neither admin nor moderator can overwrite Stripe-linked membership through this RPC. Invalid plan fails. Verify least-privilege EXECUTE grants and audit logs. No production write tests.

## Release restrictions

No production DDL, no bucket changes, no merge/deploy, no paid staging. This file is a proposal, not an applied patch.
