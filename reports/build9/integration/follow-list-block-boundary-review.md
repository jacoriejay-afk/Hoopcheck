# Build 9 follow-list block boundary review — 2026-11-21

The isolated test project currently has no `public.user_blocks` or other block/moderation table in the public/private schemas. The historical `20261113161000_public_follow_list_privacy.sql` function enforces profile visibility but **does not check block relationships**.

Repository source `supabase/migrations/20261113182500_hoopfeed_follower_only_read_rls.sql` introduces `public.user_blocks` with owner-scoped authenticated RLS, and its separate `private.hoopfeed_can_read_author` helper checks both directions of a block. That helper is for HoopFeed access and is **not called by** `get_public_follow_list`.

**Finding:** Follower-list privacy tests passed for public/private profile visibility, but blocked-user exclusion is **not implemented in the reviewed historical follower-list function**. Do not report block protection as verified or silently change the public function's policy. First establish the intended product rule for follower lists (whether both directions of a block must suppress list discovery), review the missing `user_blocks` migration dependency, and prepare a scoped candidate plus isolated regression tests. Avoid broad RLS/ACL changes or privilege escalation.

No database changes made for this audit. Build 9 remains HOLD.
