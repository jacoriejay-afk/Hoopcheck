# Player profile and directory parity

The native player route previously queried profiles directly, required public
visibility and professional experience, displayed current country without opt-in,
and omitted the website's fan restriction. Native profiles now use the existing
canonical get_public_player_profile RPC, including players-only visibility and the
website's owner fallback. A verified account from native bootstrap gates player
pages; fan/unknown accounts do not mount query content. Auth metadata is not a role
source. Identity/role changes remount the content and discard old component state.

Private profile responses are never persisted in the public directory cache.
Current country is displayed only to its owner or with a successful explicit
public-country check. Approved avatars and verified-player badges render on native
player profiles; native feed avatars require approved status. Profile avatar
images accept HTTPS URLs and fall back to initials on image failure.

The candidate migration 20261118160000_player_profile_country_privacy.sql masks
private country in the existing profile RPC and introduces search_public_players
for web/native directories and unified native player search. Its explicit output
masks private current location and unapproved avatars. Literal substring search
preserves underscores, never interprets user wildcards, and bounds pagination.
The country filter matches only opted-in locations. Fan directory calls return no
rows. Both functions remain SECURITY INVOKER, retaining table RLS enforcement.

## Verification

- Seven actual Supabase client/fetch regressions cover fan/unknown denial before
  reads, canonical profile/country checks, exact-owner fallback, unapproved avatar
  concealment, literal directory parameters and malformed response handling.
- Five unified search cases include omission of player reads until a verified
  eligible role is available.
- Real browser fixtures pass player profiles in light/dark and fan denial despite
  a spoofed player role in auth metadata. Hidden country stays hidden until the
  country RPC explicitly returns true; unavailable profiles do not fall back to
  another user's raw profile query. Existing seven browser suites pass as well.
- An official PostgreSQL 16 Alpine container with networking disabled and no
  published ports executes the actual migration against synthetic fixtures.
  Anonymous/public/player-only/owner/coach/fan/suspended cases, avatar moderation,
  country filters, literal underscores/wildcards and pagination pass. All fixture
  tables roll back. The same test fails on the original profile RPC at the intended
  "private country leaked" assertion. No production database is used or changed.
- Mobile and website TypeScript, changed-file ESLint, native/auth/URL suites and
  local web/iOS exports pass. CI repeats the SQL fixture in a dedicated disposable
  database and the browser suite. UIKit/device rendering is unverified.

## Required deployment ordering and limits

**The migration is unapplied.** Deploy it through a separately authorized managed
migration before promoting clients that call search_public_players. An absent RPC
fails closed; do not add a fallback that returns raw private location fields.
No production database changes or merge are authorized by this draft.

These tests establish the function's conditions, output masking and invoker
privilege mode; they do not certify every production profile table policy or
column privilege. Existing direct-table access elsewhere needs its own RLS/column
privacy audit. No direct-table grants/policies, membership rules, role assignments
or production records are changed by this candidate.
