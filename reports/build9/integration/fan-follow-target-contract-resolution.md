# Build 9 fan follow target contract resolution — 2026-11-21

Source review:
- `supabase/migrations/20261006102000_phase8_community_womens_profile_controls.sql` defines `follow_relationships.target_type` CHECK limited to `team`, `player`, `league`.
- `supabase/migrations/20261009111500_bind_follow_eligibility_to_current_user.sql` independently limits `can_user_follow_target` to the same three types.
- `supabase/migrations/20261113191336_protect_private_follower_counts.sql` mentions `fan` in a defensive privacy condition but does not modify the follow-table CHECK or eligibility contract.

**Decision for Build 9:** Preserve the established three-target contract. The fan privacy condition in the count function is currently unreachable for stored fan follows; do not introduce a new fan-follow feature implicitly. Any future fan following requires separate owner approval and downstream product/security design.

Isolated regression: Executed the canonical table and private RPC candidates in one `BEGIN ... ROLLBACK` transaction on `HoopCheck-PR17-Test`, simulated an authenticated fan user and another fan target, and asserted:
- `public.can_user_follow_target(viewer,'fan',target)` returns FALSE.
- `public.get_follow_count('fan',target)` returns 0.

SQL completed without reported error. Independent post-rollback query: follow table absent and original private count stub preserved. This resolves the **contract interpretation** but not real signed JWT/API acceptance or other release gates. No persistent or production changes.
