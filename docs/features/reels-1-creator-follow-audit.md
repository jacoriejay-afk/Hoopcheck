# REELS-1 creator follow implementation gate

Verified against production SQL and current GitHub source (2026-11-14).

1. `components/FollowButton.tsx` has a narrow targetType union `team | player | league | fan`, and writes directly to `follow_relationships`. UI type changes alone are insufficient.
2. `follow_relationships_target_type_check` excludes creator. Draft additive change in `reels-1-creator-follow-draft.sql`.
3. `private.hoopfeed_can_read_author` permits follower relationships only for target_type player/fan and matching account_type. Must add creator with blocked-user protections intact.
4. `public.get_follow_count` is SECURITY DEFINER and currently applies public-profile visibility only for player/fan. If creator is added, extend the visibility predicate to creator; otherwise private creators' follower counts can leak.
5. `public.can_use_unified_hoopfeed` does not include creator. Draft replacement in `reels-1-creator-entitlement-draft.sql`.
6. Verify profile role constraint and signup/account update permissions before adding creator to the account_type column. A verified Creator badge MUST NOT be inferred solely from user-editable account_type.
7. Before enabling UI, verify follow INSERT/DELETE/SELECT ownership and block behavior with real JWTs; confirm `get_follow_count` execution grants, privacy and existence checks.

Suggested follow-count visibility patch (review only):

```sql
-- In get_follow_count replace:
-- p_target_type NOT IN ('player','fan')
-- with:
-- p_target_type NOT IN ('player','fan','creator')
-- and require a matching target.account_type for person targets.
```

No database changes are authorized by this document; implement and test in an isolated production-like environment first.
