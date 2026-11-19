# Private profile fields: candidate repair and rollout

Read-only catalog inspection confirmed that `anon` and `authenticated` could
select raw `current_country`, internal moderation notes, legal acceptance and
private preferences from otherwise visible profile rows. The opt-in flag only
masked some RPC responses. Row policies cannot mask columns.

The candidate keeps the profiles table, foreign keys, write grants and row policies.
It adds an explicit owner projection with no target-user argument. The private
definer helper validates the caller's JWT identity, non-anonymous account and
verified MFA state. Public entry points are invokers. Its fixed field allowlist
excludes already-denied birthdate/Stripe identity-session fields and future fields.
The shared reader freezes the JWT, validates the returned owner, rejects account
or credential changes, bounds reads and never falls back to the raw table.

All catalog-confirmed discovery paths now mask private country in both results
and filters, including legacy search overloads and social suggestion fallbacks.
Moderated avatars remain masked. Private country equality used by existing paid,
followed-player feed authorization is retained behind a boolean-only helper.
Existing administrator cross-account reads remain guarded by their existing API.

## Deployment order — neither migration has been applied hosted

1. Rehearse `20261119074537_profile_private_field_boundary.sql` on an isolated copy
   of the target schema, after the candidate MFA/membership prerequisites. This
   installs compatible owner/discovery APIs without restricting existing columns.
2. Deploy compatible website and native owner readers. Verify the chosen test
   backend and the old-client support/update policy before the next phase.
3. Separately approve and apply `20261119075626_restrict_private_profile_columns.sql`.
   It preserves each role's previously readable public columns while revoking the
   explicit private list. It never re-grants previously denied fields. Old native
   clients still requesting raw private columns will fail those reads; this is an
   explicit rollout gate, not a claim of transparent old-client compatibility.

Do not apply the restriction first or run these files against production during
preparation. Rollback planning must use the reviewed prior column grants, never a
blanket table SELECT grant. No profile records are updated by these migrations.

## Verification on 2026-11-19

- Isolated PostgreSQL-compatible fixture passes with actual row/column grants and
  the candidate MFA helper: raw private denial, owner read/update, cross-account,
  anonymous Auth, verified-factor/AAL transitions, public opt-in, legacy search,
  suggestions, future-field exclusion, feed entitlements and administrator access.
- Negative control retains the APIs but omits only the column restriction; it
  fails specifically on the known raw `current_country` exposure. CI repeats the
  positive and negative controls on disposable PostgreSQL 16 databases.
- **177 native cases**, including seven actual-SDK owner-read/race/error/deadline
  cases, and **14 auth integration cases** pass. Root/mobile TypeScript pass.
- Full ESLint: zero errors, 125 existing warnings. Targeted new-file lint passes.
- Local production website build, bundle/theme-pair checks and six-route Apple
  certificate tracing pass. Local iOS export: 7.18 MB; native-web export: 4.30 MB.
- Real browser profile editing/review eligibility passes for men/women at 390 and
  1440 pixels; player completion/publication passes. Native browser profile editing
  passes player light/dark, fan and coach; public/private profiles pass light/dark
  and fan denial. All traffic/data are synthetic and locally intercepted.

Physical iPhone validation and approved target-schema deployment remain required.
No merge, hosted migration, production write, EAS build, OTA or submission occurred.
