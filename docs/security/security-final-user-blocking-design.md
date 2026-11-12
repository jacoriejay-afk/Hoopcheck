# SECURITY-FINAL — user blocking design and verification gates

Design only. Not applied. Based on read-only production `follow_relationships` inspection, 2026-11-12.

## Verified baseline
`follow_relationships` has `id uuid`, `follower_id uuid`, `target_type text`, `target_id uuid`, notification booleans and `created_at timestamptz`. Its sole observed RLS policy is `followers manage own`, ALL, with `auth.uid() = follower_id` in USING and WITH CHECK. This ownership rule does not independently enforce account blocks.

## Proposed minimal model
- `public.user_blocks(blocker_id uuid, blocked_id uuid, created_at timestamptz)`, foreign keys to `auth.users(id)`, composite unique key `(blocker_id,blocked_id)`, CHECK unequal IDs, index on `blocked_id`.
- Enable RLS immediately; authenticated users may SELECT/INSERT/DELETE only records where `blocker_id = (select auth.uid())`. No UPDATE policy. No anonymous access.
- A narrow `SECURITY DEFINER` predicate (fixed empty search_path and schema-qualified references) may be needed to check either direction without revealing block rows. It must reject anonymous callers or be exposed only via tightly scoped internal paths; avoid an oracle that enumerates blockers.
- Deny new person-to-person follows if a block exists in either direction. A policy alone is insufficient for all paths: privileged writes must enforce the same rule, ideally through a database trigger or a shared authoritative server path.
- When creating a block, remove existing follows between the two accounts atomically, subject to verified `target_type` values (`player`/`fan`) and preserve team follows. Do not assume all UUID targets represent user accounts.
- Public follow list/count RPCs must omit edges involving a block between the viewer and either participant; distinguish anonymous public browsing from signed-in block behavior.
- Enforce block rules in feed comments/reactions, notifications, direct messages, profile discovery, and fan chat as appropriate; do not use client-only filtering.
- Prevent blocked account content from being delivered via realtime subscriptions or server-role endpoints; evaluate caching and count leakage.

## Isolated verification matrix
1. A blocks B; B cannot follow A; A cannot follow B; pre-existing A/B follows removed.
2. B cannot interact with A's personal content via service-role API, including crafted direct requests.
3. A and B cannot message each other; unrelated C interactions still work.
4. Public profile C is discoverable to anonymous visitors; private account D remains private.
5. Anonymous callers cannot list block relationships.
6. A can unblock B; follows do not automatically reappear.
7. Team follows and club fan groups remain unaffected unless explicitly specified.
8. Block operations are idempotent and concurrent requests cannot bypass the rule.
9. Privileged follower-list RPCs do not disclose blocked edges or identities to the relevant signed-in viewer.
10. RLS and server-side checks remain effective under forged `target_type` and `target_id` inputs.

## Open product/security decisions
- Whether a block hides the blocker’s otherwise public profile from the blocked person.
- Whether shared team/game chats conceal individual messages or deny room participation.
- How moderation staff investigate abuse reports while respecting blocks.
- Whether follower counts should exclude blocked edges globally or only per viewer.

**Release status:** proposed architecture only; no executable migration, production changes or end-to-end tests.
