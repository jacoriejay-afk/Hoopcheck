# Build 9 installed follow RPC security mismatch — 2026-11-21

Target: **HoopCheck-PR17-Test** only. All hosted checks were read-only.

## Observed installed contracts

| RPC | Owner | SECURITY DEFINER | search_path | EXECUTE ACL |
| --- | --- | --- | --- | --- |
| `public.can_user_follow_target(uuid,text,uuid)` | postgres | false | empty | postgres, authenticated, service_role |
| `public.get_follow_count(text,uuid)` | postgres | false | empty | postgres, authenticated, service_role |

The repository's historical `20261009111500_bind_follow_eligibility_to_current_user.sql` defines `can_user_follow_target` as SECURITY DEFINER with an empty search path, binding `p_user_id` to `auth.uid()`. The historical `20261113191336_protect_private_follower_counts.sql` defines `get_follow_count` as SECURITY DEFINER with an empty search path and a private-profile visibility filter.

**These are not identical installed contracts.** A blanket `CREATE OR REPLACE FUNCTION` replay would change privilege execution mode, potentially changing RLS behavior. Do not infer the installed implementation from the historical migration body.

## Further verified gaps

- `public.follow_relationships` absent.
- `public.get_public_following_count(uuid)`, `public.get_public_follow_list(text,text,uuid,uuid)`, `public.get_shared_team_followers(uuid)` and `public.get_social_suggestions()` absent.
- The two installed invoker functions have explicit ACLs; do not widen them to PUBLIC/anon.
- The protected player-profile RPC has a different, scoped SECURITY DEFINER owner and must not be replaced by the ordinary postgres runner.

## Repair gate

1. Capture and review `pg_get_functiondef` for both installed invoker RPCs (redact any secrets); compare their effective SQL and return signatures with the canonical repository migrations.
2. Inventory current table grants and RLS; determine whether the invoker behavior is intentional and already hardened. Preserve the narrower behavior unless a reviewed contract and regression evidence require change.
3. Build a minimal follow-graph reconciliation from the canonical schema and **all later privacy migrations**, not from a single early migration. Preserve original constraints, owner-only writes, follower-only HoopFeed access, block filtering, and private follower counts.
4. Run rollback-only isolated SQL and real signed-in owner/non-owner/anonymous privacy tests. No synthetic-claims-only signoff.
5. Keep the separately blocked player-profile owner-capable migration as an independent gate. No production DDL, role escalation, EAS, merge or deployment.

**Status:** diagnostic evidence only. No hosted database writes and no approval to apply migration.
