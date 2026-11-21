# Build 9 compatibility and compensation review

Continuation of #746 from 9009bd2. No hosted migration or release approval is implied.
This document and local tests do not close installed Build 7 acceptance.

## Installed client design

Build 7's recorded source fe9691b7d619e92370ac498169f7b36d8b64d1c2 is not
available in the repository (exact fetch returned `not our ref`). Obtain the
uploaded source including dirty changes or capture its actual PostgREST requests
on an owner-operated test device. Preserve the installed app's data and logs.

Column grants cannot distinguish an owner's private value from another caller's
public read. Regranting raw columns would reopen privacy exposure. RLS alone
cannot mask columns. Request headers or a claimed app version are not trusted
authorization boundaries. Keep the final restriction blocked until a verified
transition exists; preparation alone does not close the current raw-read exposure.

An alternative is a legacy-shaped **masked projection** at the old API name,
backed by inaccessible storage and explicit owner/MFA/visibility checks. It can
return a caller's own country/preferences and NULL for other callers' private
values while retaining opted-in public country. Filtering operates on the masked
value so it cannot become an equality oracle. Explicit allowlists exclude future
private columns. A projection may be a deliberate, narrowly scoped definer helper;
ordinary views need security_invoker=true to avoid silently bypassing RLS.

`supabase/tests/build9_legacy_projection_design.sql` proves this read-contract
mechanism on synthetic data, including anon, anonymous Auth, owner, cross-owner,
hidden/suspended rows, private filters, MFA denial/recovery and denied raw reads.
It creates only a temporary design schema in a rolled-back test transaction.
It does not change public.profiles or propose an automatically deployable migration.
Writes are deliberately rejected in this prototype.

Before selecting this design, inventory Build 7 SELECT column lists, filters,
ordering, wildcard reads, INSERT/UPDATE/upsert/returning, RPC calls and embedding.
An actual public.profiles table-to-view transition must preserve OID/FK/trigger
dependencies or explicitly migrate them, check function binding versus textual
references, PostgREST relationship discovery/schema cache, owner write triggers
with explicit writable fields, service/admin paths and Auth signup triggers.
Test pagination/counts and prepared queries. Test both the old and new clients.
Do not rename the production table or stack an alternate privacy migration based
on this prototype. The existing five candidate migrations are unchanged.

## Concrete local compensation rehearsal

`scripts/rehearse-build9-compensation.py OUTPUT` generates an isolated catalog
rehearsal from the existing production-catalog fixture. Restore the protected
schema-only metadata into a fresh local database first using BUILD8-CATALOG-REHEARSAL.md.
Use `--sql-root /repo` when that is the read-only repository mount in Docker;
the generator resolves migration/compensation includes to that execution path.
Only local socket database hoop_prod_rehearsal is accepted. Never run generated
restore or rehearsal SQL against a hosted database.

The sequence applies/checks the five migrations, seeds synthetic Stripe/manual
and Apple membership, snapshots all public/hoopcheck_billing rows, effective tiers
and function definitions, and **commits**. A separate transaction executes
`scripts/sql/build9-pause-new-apple-intents-local.sql` and **commits**. Assertions
prove new service-role intent calls are denied, existing Apple/Stripe/manual
access and all rows/definitions remain unchanged, raw private columns remain
denied, and sync/notification execution remains available. This proves a limited
compensating containment action, not reversal of all five migrations.

Do not disable apple_billing_config.enabled as a generic rollback: membership_sources
uses it when determining existing Apple access. Do not drop ownership, receipts,
notifications, trial or commission records. The tested intent privilege pause
does not cancel an already issued intent or an in-flight Apple sheet, and catalog
offers may remain visible. Coordinate backend purchase-entry gating with the
separately approved incident response while preserving receipt sync/refunds.

## Approval and PITR prerequisites — owner completion required

The DBA/security/data owner must record and sign off on:

- Target project, exact release SHA and each migration hash; capture time and
  schema/ACL/function/hook fingerprints immediately before rollout.
- Actual backup/PITR availability, retention window, recovery point timestamp,
  restore operator, destination and authority. A metadata export is not a backup.
- Isolated restore drill with acceptable RPO/RTO and schema plus financial-data
  validation. Never overwrite current production payments with an old snapshot
  as a convenient schema rollback; reconcile post-recovery financial events.
- The limited containment action above, handling of in-flight purchases and
  released APIs, incident stop criteria, owners and restoration procedure.
- Committed-state tests for any additional per-object compensation. Preserve
  released RPC signatures/defaults and private-column denial. MFA relaxation or
  raw-column regrant requires separate explicit security approval.

No such owner approval, live PITR verification or full restore drill has been
established here. Local successful SQL cannot approve production operations.

## Hosted 404 diagnosis and deployment dependency

Read-only Vercel inspection identifies production deployment
dpl_Hc62CWyFuX4jqNiDWsMwEXhWoN2j, alias hoopcheck.online, source main
9e11cb7bf6976174a49562cabf21dddee2f40ffb. That source lacks
app/api/membership/route.ts and app/api/mobile/purchases/config/route.ts;
#746 contains both. Their HTML 404 is an undeployed API contract, not evidence
of JSON corruption in the candidate handler. The native transport now classifies
404 as unavailable without displaying the HTML body and permits retry.

Production and the PR17 test database both lack the candidate owner RPC,
username RPC, membership view and Apple config table in the last read-only
inspection. Independently approve preparation and deployment to a named isolated
target, then verify real JSON/auth contracts there. Do not point a purchase test
at production or infer readiness from a project whose name includes sandbox.

## Billing, signing and physical owner gates

The isolated target needs reviewed schema, backend-only Apple credentials,
Sandbox products/group/test identities, signed Apple notifications, verified
Stripe test context/prices/webhook and synthetic accounts. Real purchase/cancel/
pending/restore/ownership/expiry/refund/replay and Apple/Stripe overlap remain
unrun; fixture success cannot pass them. Keep production purchases/trials unchanged.

Existing Build 8 f0dd9cd3-cee2-49a7-b541-5485144f377e, source c0b77ba3,
is finished. Its inspected archive is 0.2.0 (8), online.hoopcheck.app, team
Y778LM35G5, with applinks:hoopcheck.online and get-task-allow=false. Profile and
certificate dates expire 2027-11-16. This does not prove credential revocation
status, full codesign verification or the next remote counter. Owner must inspect
current managed credentials/counter/env metadata privately; no EAS started here.

Physical acceptance starts on the affected iPhone 14 Pro/iOS 26.6.2. Record build,
source, API/database target, time, theme and test identity. Preserve Build 7 logs
before replacement. Follow BUILD8-IPHONE-AND-SANDBOX-RUNBOOK.md with #746:
fresh/restored onboarding, scroll/taps/all tabs, foreground/background app lock,
MFA, profile load/edit, membership failure/retry and username search; light/dark,
keyboard/safe areas, VoiceOver/large text and universal links. Capture redacted
Console/hang logs and screen recording if frozen. No device results supplied:
#699 and the physical P0 acceptance gates remain open.


## Completion continuation from acbd66b5 (2026-11-20)

`completion/build9-20261120` preserves #746's exact source and five unchanged
migration candidates. See `reports/build9/completion/README.md` for fresh evidence.
The lost local baseline is no longer a prerequisite for this authorized continuation.

Fresh unauthenticated probes confirm both production API paths return HTML 404.
Vercel still identifies production as main 9e11cb7, deployment
`dpl_Hc62CWyFuX4jqNiDWsMwEXhWoN2j`. No deployment was performed. A verified
DB-disabled Apple catalog now returns private JSON with `canPurchase:false`, an
empty product list and null environment, without constructing Apple signing
services. Missing config/schema still fails closed; enabled catalogs and all
purchase/sync authorization retain their prior checks. New native readers accept
null environment only when purchases are explicitly disabled. The membership
screen clears stale notices on refresh in either theme.

A repeatable `--synthetic` option now runs the limited committed purchase-intent
containment against synthetic StoreKit fixtures; CI exercises it over a container
Unix socket. The generated SQL rejects an incorrect database or TCP connection
before any fixture DDL. It commits forward fixtures, commits the intent privilege
pause twice, compares every public/billing row, effective entitlements and function
definition, and retains sync/notification privileges. Synthetic mode omits the
catalog-specific current_country ACL assertion because that fixture has no such
column; independent profile/MFA suites cover privacy. This is not production
schema or full five-migration compensation clearance. Default catalog mode keeps
its privacy assertion and still requires approved exports.

Future EAS upload exclusions now include local secret/key files while retaining
native sources under modules/*/ios and modules/*/android. Expo diagnostics pass.
No signing credential is changed. Remote version query is blocked by unauthenticated
EAS CLI; the next build number must be privately verified by the Expo owner rather
than set from historical Build 8. No build, update, submission or purchase enablement
is authorized by these preparation results.
