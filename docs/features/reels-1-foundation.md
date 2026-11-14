# REELS-1 foundation — implementation contract

Status: planning-only, feature disabled. Do not enable or merge a launch feature without security verification.

## Existing code evidence
- `lib/membership-tier.ts` exposes `getHoopCheckEntitlements`, `canReadHoopFeed`, and `canWriteHoopFeed`.
- The resolver currently does not recognize the `creator` account type.
- `docs/security/hoopfeed-check-rls-review.md` documents an unresolved non-player Check RLS mismatch. Verify and fix this first.
- Creator verification must be a separately authorized flag, not a client-supplied role or admin permission.

## Access rules
- Reels must use existing HoopFeed read/write entitlements; no separate tier or Stripe logic.
- A creator profile/category is not a paid subscription entitlement and never authorizes club reviews or administration.
- The Free upgrade screen must be the existing HoopFeed upgrade screen.
- All API routes, RLS policies, storage reads, and mutations must enforce the same server-side access.
- Blocked accounts and removed/under-review reels must be excluded at the data layer, not only hidden in UI.

## Proposed additive data
- `reels`: id, author_id, video storage path (not an unguarded public URL), poster storage path, caption varchar(300), duration_sec, club_id, league_id, linked_profile_id, visibility, status, checks_count, comments_count, created_at.
- `reel_checks`: reel_id, user_id, created_at; unique(reel_id,user_id).
- `reel_bookmarks`: reel_id, user_id, created_at; unique(reel_id,user_id).
- `reel_comments`: id, reel_id, author_id, body, status, created_at.
- `reels` storage bucket: `{author_id}/{reel_id}.mp4`; authenticated, access-controlled delivery.
- All tables require reviewed RLS policies and negative JWT tests before any production migration.

## Release blockers
1. Confirm Report + Block integration for reels, comments, and accounts into existing moderation queue.
2. Verify active Pro/Premium access and visibility policies with populated JWT fixtures across roles, including creator.
3. Verify private/blocked/removed media is inaccessible by direct storage URL, not merely absent from listings.
4. Enforce <=90 seconds, <=100 MB, valid media MIME and ownership server-side; client checks are supplemental.
5. New accounts <24h limited to 1 reel/day until qualifying trust threshold; rate limit must be transactional.
6. Verify author moderation actions and appeals after remaining original specification is provided (original text ends at 'Authors').
7. Run TypeScript, relevant CI, Supabase security checks, and both-theme mobile/desktop tests.

## UX acceptance
- Posts | Reels within HoopFeed; snap-scroll 100dvh, muted autoplay, hold-to-pause, next-two preload, blur pause.
- Check uses up-arrow, no downvote. Comments bottom sheet, save, share link, profile and entity chips.
- Reels do not appear in reviews and do not affect trust scores.
- One tagged club/league/player per upload; profile 3-column grid, club/league strips.
- Claimed club may pin only one of its own reels; other authors' reels can only be reported.
- v1 order followed authors first then newest; no algorithmic-ranking claims.

This document is a pre-implementation gate, not evidence that migrations, features, or security tests have shipped.

## Production schema verification (2026-11-14, read-only)
- Production has `public.feed_posts`, `public.feed_post_comments`, `public.profiles`, `public.subscriptions`, and `public.leagues`.
- Current production policy names include `unified hoopfeed checks insert`, `unified hoopfeed checks read`, and `unified hoopfeed approved posts read`. Policy names alone are not proof of effective permissions; JWT role tests are still required.
- The separate HoopCheck-PR17-Test database is not a complete production clone and has seven existing public tables with RLS disabled. Do not use it as a production-equivalent security signoff without fixing/isolating that discrepancy.
- No Reels DDL or storage policy was applied to production during this inspection.
