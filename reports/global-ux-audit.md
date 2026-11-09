# Global UX completion audit

Date: 2026-11-09. Scope: existing web application. This report distinguishes inventory, implemented fixes, fixture verification, and outstanding production verification. **The global definition of done is not yet met.**

## Baseline inventory (captured before product edits)

Baseline commit: `f63bd02b089690c7ea999be5dc89c9379b41ae42`. Regenerate the original snapshot with `node scripts/inventory-ux.mjs --ref=f63bd02b089690c7ea999be5dc89c9379b41ae42`.

`ux-route-inventory.md`: 79 page routes and 31 API routes, including admin and diagnostic routes. `ux-inventory.json`: 1,005 control declarations across 211 source files, with source lines, attribute expressions, role signals, and state signals, and action label expressions. Shared components and dynamic destinations are included. Regenerate with `node scripts/inventory-ux.mjs`; the committed snapshot is the pre-edit baseline, so line references may move.

## Highest-impact findings and changes

1. Header and bottom tabs resolved roles independently. They now consume one presentation identity keyed to the current authenticated user; stale responses from a prior user are discarded. Unknown roles receive neutral navigation. Admin presentation state clears on sign-out. Authorization still belongs to existing page/API/RLS checks.
2. Coaches/managers were shown player-feed entry points. Shared navigation now routes fans to Fan HQ/Fan Feed, agents/scouts to Agents HQ, managers to Team HQ, and coaches to placement/team tools. Membership comparisons, settings, support and privacy center now have global entry points. Player-only shortcuts remain absent from fan navigation.
3. Mobile fan-feed tab was misleadingly labeled FAN HQ. It now says Fan Feed; Fan HQ points to `/team-hub`. Account tab points to `/account` and remains active on `/profile`.
4. Desktop More menu persisted after selecting a destination. Both menus now close on selection, outside pointer interaction and Escape; Escape returns keyboard focus. Menu toggle exposes its controlled navigation ID. Active links expose `aria-current`.
5. The final flow stylesheet stripped frames and radii from semantic cards. Shared cards now use existing paired theme colors, one border, a shared 16px radius and restrained shadow. Nested informational cards lose redundant frames. Directory rows and feed streams remain compact and frameless.
6. Public About/Founder/Company routes used unprocessed Tailwind utilities. They now have an explicit shared reading layout, responsive headings and separated company links. Footer text now uses theme-aware foregrounds; decorative artwork is subdued.
7. Fixed `/account#edit-profile` to `/account#profile-editor`. Added role-specific dashboard tools, keyboard skip navigation, global focus treatment, accessible account switch names, default non-submit type for shared buttons, and visible labels/live feedback on the partnership form.
8. Shared legacy primary buttons now pair the existing orange token with its dark foreground. Secondary controls, filter chips, theme-option tiles, directory intros, coach heroes and legal navigation use paired colors. Visually-hidden signup labels now have an actual `.sr-only` implementation.
9. Fixed fan-feed translation fallbacks that exposed humanized keys such as “Feed Explainer” and “Empty Club Title” instead of authored copy.
10. Player-feed Check actions could send concurrent mutations on repeated taps/double clicks. A synchronous per-post lock now prevents concurrent requests; controls expose pending/pressed state. Failed requests retain the previous count/selection and report an error. Existing success animation and reduced-motion handling are retained. Comment toggles expose expanded state.

## Feature and eligibility map

Source of membership truth: `lib/membership-tier.ts`. This table documents existing rules; navigation is not an access grant. Free members may discover locked destinations, which must retain their existing gates.

| Feature family / actions | Existing entry points | Existing eligibility / remaining checks |
| --- | --- | --- |
| Home, search, directory filters, public profiles | `/`, `/search`, `/directory`, `/teams`, `/womens`, `/coaches`, `/leagues`, `/players` and `/:id` | Public discovery; sensitive fields and full reviews remain individually gated. Fan global navigation excludes players. Full query/state tests still required for each directory. |
| Signup, login, password reset, username/profile setup | `/signup`, `/signup/complete`, `/login`, `/reset-password`, `/onboarding`, `/onboarding/teams`, `/choose-username`, `/complete-profile` | Existing auth/onboarding rules. Real email confirmation, reset delivery and interrupted setup remain unverified. |
| Player HoopFeed: compose, photo/video, topics, checks, share, comments, archive, filters | `/feed`, player/agent/scout navigation; player dashboard | Read: active Pro+ player/agent/scout. Write: Pro+ player. Agent/scout mutation buttons remain gated. Feed reactions verified separately with failure/duplicate fixtures. Moderation/storage/realtime need live verification. |
| Fan Feed and Fan HQ: followed clubs, groups, posts/comments/media, membership/moderation | `/fan-feed`, `/team-hub`, `/team-hub/groups/[teamId]`, team profile group entry | Fan Feed membership and actual group-member reads are distinct; fan group eligibility is fan at all tiers, while membership/post visibility is enforced by existing group API/RLS. Existing source checks cover membership/media policy structure; production behavior unverified. |
| Live games, chat/presence, predictions and leaderboards | `/live-games`, `/fan-live`, live links for player/fan | Existing entitlement resolver: active Pro+ player/fan, or admin. Game status/time windows and API rules still apply. Live realtime/reconnect and polls require real games/accounts. |
| Reviews, review reactions/reports, official responses, trust scores | `/reviews`, entity profiles, entity `/review`, review checklist in account | Write: verified Pro+ player plus existing affiliation rules. Full reads/trust: Pro+ player/other paid professional, Premium fan, or admin. Existing API/RLS remain authoritative. |
| Pre-Sign checklist, compare, contract/pay research | `/pre-sign`, entity profiles and existing research controls | Player checklist shortcut; paid research eligibility differs by tool in entitlement resolver. Contract/pay controls must be verified in context; no new feature or permission introduced. |
| Passport, recruiting, Ask Player/contact, connections | `/profile`, `/players/[id]`, `/connections`, account tools | Passport: Premium player or Pro+ agent/admin; recruiting: Premium player; Ask Player: Pro+ player/scout/agent. Private contact visibility and request acceptance remain server controlled. |
| Player pay check-ins and team pay history | Team profiles / pay timeline | Submit: verified Pro+ player; history: existing non-fan members. Affiliation and API checks remain unchanged. |
| Agents/scouts workspace | `/agents-hq` and role dashboard/global shortcuts | Agent/scout navigation workspace only; downstream contact permissions unchanged. |
| Team HQ: approved claims, official posts, logos, group summary | `/team-dashboard`, coach/manager navigation, claimed team profiles | Page currently accepts coach/manager/admin then scopes to approved claims. `club_admin` appears elsewhere but is not a valid production profile role. A read-only catalog query confirmed the profile constraint permits player/coach/manager/scout/agent/fan. Treat club_admin references as stale until intentionally migrated; no access widening. |
| Coach placement and verification | `/coach-placement`, `/verification`, coach tools | Existing coach rules; paid identity verification eligibility is Pro+ coach. Production placement workflow remains unverified. |
| Fan discovery, connections, basketball-side switching | `/fans`, `/fans/[id]`, Fan HQ/feed controls | Fan connections and side switching: Pro+ fan. Existing privacy rules remain unchanged. |
| Notifications, settings, profile, account, privacy and support | `/notifications`, `/settings`, `/profile`, `/account`, `/privacy-center`, `/support` | Existing signed-in settings/account management. Role-specific profile fields unchanged. Deactivation/deletion and privacy exports require isolated real-account validation. |
| Membership checkout/portal/cancel | `/membership`, account membership row | Existing Stripe products, role comparisons and server checks unchanged. No checkout, cancellation, subscription or production data mutation performed. |
| About, founder, company, partners, policies, offline | `/about`, `/founder`, `/company`, `/partners`, `/terms`, `/privacy`, `/community-guidelines`, `/copyright`, `/offline` | Public information; partner submission requires signed-in account. Legal company-registration copy explicitly pending verification; do not invent legal details. |
| Administration and moderation | All `/admin/*` routes; privileged account entry | Existing admin/moderator checks and RLS unchanged. Do not infer eligibility from a visible link. Each admin action still needs an isolated privileged workflow test. |

## Verification and remaining delivery

Validation results and screenshot references are appended after execution. Browser fixtures cannot prove production RLS, real subscription state, external service delivery or live realtime behavior.

Required follow-up before global completion: every inventoried conditional control/state, all dynamic profile variants, admin workflows, real-account role/tier journeys, native app scope if requested, translations, keyboard/screen-reader review, complete computed contrast checks, live chat/reconnect, moderation/storage, subscription lifecycle, and production deployment checks. The baseline inventory records where to inspect; state-name matches are not proof that the state is complete.

## Read-only platform evidence

The Supabase catalog confirms production profile roles are player, coach, manager, scout, agent and fan. RLS is enabled on the inspected profiles, subscriptions, feed_posts, feed_post_checks, profile_claim_requests, team_fan_group_members and team_fan_group_posts tables. This checks policy presence, not role-specific policy behavior. No user rows, schema, subscriptions or account records were mutated. The connected isolated PR17 test project is inactive; real-account validation is pending an environment/provisioning choice.

Vercel inspection found the existing `hoopcheck` production deployment READY at commit `b0338f95d16d7324a74646d4046529a6f87938a5`. That deployment predates these changes. No merge, deployment, promotion, database migration or billing action was performed.

## Final local verification

- Production build, bundle limit and hub source checks: PASS.
- Lint: 0 errors, 143 warnings (baseline: 144 warnings).
- Existing entitlement matrix: PASS, 10 role/tier cells plus edge cases across 22 entitlements.
- Role navigation and authored fan-feed fallback copy tests: PASS.
- Existing hardcoded-surface, paired theme-token and card checks: PASS.
- Focused UI matrix: 66/66 PASS across visitor, player Free/Pro/Premium, fan Free/Pro/Premium, agent, scout, manager and coach, at 390/768/1440px in both themes.
- Narrow/breakpoint fan matrix: 18/18 PASS at 320/700/701px in both themes.
- Final-build player smoke/reaction matrix: 4/4 PASS at 390/1440px in both themes.
- Reaction interactions: PASS for pending feedback, concurrent-request suppression, confirmed count/selection, denied-request retention and removal.
- Existing profile editor: PASS for men/women, mobile/desktop, privacy preservation and review eligibility.
- Existing team discovery: PASS in both themes at mobile/desktop, including long names, partial directory failure, centered loading and reduced motion.
- Existing theme suite core assertions and live language switching: PASS. However its broader sweep reports 24 flagged cases out of 78. The script exits zero despite these flags. See `ux-remaining-issues.md` and `ux-verification.json`; **this is not a globally passing visual audit**.

Screenshots are generated locally and the implementation adds CI artifact capture for shared-UX checks. Browser tests use synthetic sessions and mocked records only. Server-side SEO/database calls against the intentionally invalid CI host can log expected DNS failures; these do not establish a production fault. No auth bypass has been introduced for a real Supabase project.

## Publication authorization

The user explicitly approved uploading the inventory/report and the 29 implementation files to the public `jacoriejay-afk/Hoopcheck` repository and opening separate draft PRs. This follows earlier automatic-review rejections for those exact payloads. Publication is authorized; merging and production deployment are not part of this batch.

Implementation: [draft PR #372](https://github.com/jacoriejay-afk/Hoopcheck/pull/372). This companion audit remains a record of the first batch, not global completion.
