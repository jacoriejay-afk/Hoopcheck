# HOOPDATA-1 — Build 16 audit and release gates

Scope: development-only integration/build16-launch-candidate. No production cron dispatch, production database migration, paid provider subscription, EAS build or App Store submission.

## Verified in the integration baseline
- API-Sports date-scoped ingestion: one authenticated request per scheduled invocation; 96 scheduled daily slots, with 88 for today's scores and eight for seven future dates plus yesterday. Scheduled cadence is best effort, not actual provider latency or a hard shared quota.
- Unique (provider_source, provider_game_id) index protects identity within a provider; existing team map does not include provider namespace. Cross-provider duplicates are NOT solved by this index.
- BALLDONTLIE NBA endpoint is an authenticated, read-only validation probe. It must not write to the canonical game table until reviewed league/team mappings and identity reconciliation pass.
- Existing web game availability helpers format viewer-local time and group dates across daylight-saving transitions; native parity requires separate acceptance.
- Existing reminder loop creates in-app notices for explicitly saved game reminders, not verified automatic device push. Retry/idempotency and opt-in must be proven before activation.
- Existing delayed-result handling avoids elapsed-time synthetic finals. Owner provider directory exists, but a complete Owner HQ sports data center has not been verified.

## Phase A changes
- Reject duplicate/malformed same-provider fixture IDs before mapping/game writes; reject invalid numeric scores and timezone-free timestamps; preserve postponed/abandoned distinctions.
- Live Games web display uses observed snapshot receipt time and labels delayed (>25 minutes) and unknown freshness. This threshold is a policy choice based on the current 15-minute scheduler, not a provider SLA. Older schemas fall back only on missing-column error.
- Regression tests in CI. No new provider calls or secret requirements.

## Phase B development foundations (not active)
- Corrected the Phase A TypeScript build error in the fixed-field freshness projection.
- BALLDONTLIE NBA/WNBA fixtures are normalized separately, including explicit lifecycle, season, postseason, UTC tip-off and nullable scores. Bounded cursor pages reject duplicate identities, inconsistent seasons and nonadvancing cursors.
- Reviewed canonical aliases preserve existing fan_live_games IDs, with provider namespace uniqueness and no fuzzy-match writes. SQL is review-only and not applied.
- Shared quota reservation SQL serializes requests per credential pool and enforces rolling minute/day limits; no enabled quota seeded. Monotonic cooldown prevents concurrent responses from shortening a block. No production route invokes it yet.
- Budget-first page-fetch helper reserves before any HTTP attempt, honors Retry-After, never retries implicitly, and stops when the quota store is unavailable. Synthetic CI fixtures exercise this contract.
- Provider docs: https://docs.balldontlie.io/ and https://wnba.balldontlie.io/. NBA free tier includes games (5 requests/min), not official standings. WNBA availability must still be verified against our account; no subscription changes authorized.
- Actual importer checkpoints, provider fallback writes, alias review UI, quota RPC wiring, concurrency stress test and complete-season certification remain gated.

## Phase C development and test fixes
- Fixed the malformed PostgreSQL cooldown function delimiter; isolated quota/alias rehearsal passed on commit 35a83edf. Its later production build found a remaining Supabase literal-query type mismatch; repaired on the branch.
- Resumable season page staging with atomic cursor compare-and-commit, per-provider/season fixture uniqueness and separate completion versus coverage-certification semantics. Preview POST route is disabled by default, requires dedicated credentials and refuses the existing application DB. No schedules or provider calls activated.
- Coverage-certified provisional regular-season records helper; no rank or official tiebreak claims. Fallback proposals require reviewed game/team mappings, matching exact tip-off, score orientation, fresh secondary snapshot, stale primary and no downward score correction; no fallback write is enabled.
- Owner HQ Basketball Data Center uses the existing verified owner-only session check and reads stored fixture counts, last snapshot, delayed records, missing opponent and league mappings, and separately labeled men's/women's catalog counts.
- Manager submission SQL is review-only: approved team claim, manager/club_admin role, active same-side same-league teams, own-record access, pending-only inserts, no self-approval; schedule horizon 18 months and result lookback 30 days are conservative policy choices pending owner review. Cross-league fixtures need a reviewed competition workflow.
- Game-day push SQL is review-only: explicit user opt-in and unique user/game/event outbox; actual native permission, tokens, scheduling, delivery, retry lease, quiet hours and reschedule/cancellation handling remain unimplemented.
- Expanded isolated SQL and source-level regression coverage; exact latest head CI still required. All new SQL files remain candidates, not deployed migrations.

## Remaining gates — do not mark complete on the strength of Phases A/B/C
1. Faster sync: confirm actual free limits and scheduler capacity, use shared durable atomic request reservation per provider/time window, count failed requests and manual invocations, honor Retry-After, bounded backoff and circuit-breaker. Preserve existing production workflow until rollout approval. Realtime delivery is not upstream polling.
2. Full schedules: verified league+season IDs, paginated bounded import with resumable checkpoint, include postponed/rescheduled games, avoid partial import silently appearing complete.
3. Standings: import official tables with phase/group and timestamp, or calculate clearly labeled provisional tables only from complete verified results and competition-specific tiebreak rules. No guessed rank.
4. BALLDONTLIE production readiness and fallback: server-only keys, explicit provider namespace and reviewed competition/team IDs, canonical fixture mapping (provider aliases tied to existing game ID), transaction-safe uniqueness and ambiguous-match quarantine. Never match solely by team name or overwrite another provider's identity. Protect current game chats, predictions and notifications.
5. Coverage audit: report each men's/women's league, season and verified provider availability, supported fixtures/standings, missing/ambiguous team maps, update freshness and source provenance. A catalog listing is not live coverage.
6. Team manager submissions: verified active club membership checked server-side, own-team scope, opponent/league/time validation, pending review, evidence and audit log, no unaudited final or direct canonical writes; RLS negative tests and conflicts with provider results.
7. Push: opt-in for followed teams/leagues, device token lifecycle, unique per-user/game/event outbox, reschedule/cancel and retry semantics, quiet hours and authorization. Isolated delivery tests, no actual sends until authorized.
8. Time: store UTC, display viewer-local timezone in native/web, check DST and date-only/time-unconfirmed data; test multiple timezones.
9. Season rollover/playoffs: explicit source season and stage identity, detect verified new season, archive history, reconcile playoff brackets, no assumption from calendar year.
10. Owner HQ: server-authorized owner-only coverage, per-provider health, quota, last successful fetch, retries, mapping review and pending submissions; no secrets or direct insecure writes.
11. Verify actual provider coverage, failure and retry behavior, budget under concurrency, canonical duplicate reconciliation, full regression tests, mobile acceptance and isolated staging rehearsal before merging further phases.

Production activation and paid API changes require separate owner approval.
