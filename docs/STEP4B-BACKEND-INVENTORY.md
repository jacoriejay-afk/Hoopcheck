# Step 4B: read-only backend inventory — 2026-11-27

Refs #1139, #1140, #1137, #1138, #1006. Source baseline 1293215ca9fb7dc1db12f374808e61a0560f8cd4. Hosted catalog inspected in read-only transactions with five-second statement timeout. No user rows, keys, storage objects or data exports collected. No database mutations.

| Catalog measure | Production | Existing test project |
| --- | ---: | ---: |
| PostgreSQL | 17.11 | 17.11 |
| Public tables | 108 | 46 |
| Public tables without RLS enabled | 0 | 1 |
| Public functions | 98 | 50 |
| Public indexes | 348 | 90 |
| Zero-scan indexes | 133 | 34 |

Production stats reset recorded 2026-09-29 UTC; test reset unknown. 58 production zero-scan indexes are valid, nonunique, nonprimary, nonexclusion and not directly constraint-owned. They are **review candidates only**: FK checks, rarely used routes, season workloads, query plans, overlapping indexes, legacy clients and future migrations must be examined before any removal. Production database size 31,528,627 bytes (excludes object payloads); 9 storage buckets, 2 public; cron schema absent (does not rule out external scheduling). Public table RLS enabled is not proof that policies or grants are safe. Existing test table fan_live_team_provider_map lacks RLS; anon/authenticated SELECT both absent, other privileges not verified. Do not use the test project as production-equivalent.

Production performance advisors returned five notices: unindexed foreign keys, auth RLS initplan, unused index, multiple permissive policies and duplicate index. Review each against production query plans and existing candidate migrations before any changes. No recommendation to remove objects solely from counters. See https://supabase.com/docs/guides/database/database-linter and https://supabase.com/docs/guides/observability/inspect.

## Release acceptance status
- Existing synthetic restore passed #1140; existing test project's catalog mismatch and PG16 fixture vs production PG17 prohibit claiming full-schema recovery. Coordinate #1138 and existing migration work; use a separate disposable PG17-compatible local full-schema environment, synthetic seed, and independent validation. No hosted reset or restore.
- Cost: database bytes and index counts are measured; actual invoices, egress, storage usage, request counts and forecast are unknown. Obtain aggregate provider billing and delivery data before declaring cost audit complete. Do not equate DB bytes with billed storage.
- Bounded anonymous loopback burst check added; it measures public route availability and observed latency, not a capacity claim, authenticated traffic or a production benchmark.
- Offline/abuse and accessibility: #1006 and #1075 own these surfaces. Need exact-source acceptance for interrupted upload (retry after uncertain result without duplicate publishing), account switch isolation, block/report and duplicate notifications, VoiceOver/TalkBack, larger text, and older device compatibility. No live traffic load or media mutation.
- No production deploy, cleanup, migration, EAS, or store action. Step 4 remains open. 
