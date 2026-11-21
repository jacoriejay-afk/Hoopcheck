# Build 9 continuation release review

Starting head: eb9f7478918b6d552d695ecf465af5a390ffb202.
Branch: fix/build9-iphone-repairs. PR #744 stays draft; no merge authorized
until design scope and every required exact-head gate are complete.

## Native-only continuation

Shared title typography now serves Home, HoopFeed, Live Games and HoopGroups.
HoopGroups uses existing entity artwork and skeletons; Live Games uses the same
skeleton during access verification. Player identity leads with the avatar rather
than an empty orange banner, and its back control has a labeled 44-point target.
Feed composer colors follow the existing theme. Home directs feed discovery to
the existing native entry rather than duplicating a web link in account support.
These are incremental improvements, not evidence that the full premium redesign
or physical iPhone interaction review is complete.

## Inherited backend scope — separate release decision

`inherited-migrations.txt` lists migration files present in the consolidated PR
relative to main. This continuation changes none of them. The PR also inherits
server and billing implementation; merging is not a native-only release decision.
The prior detailed compatibility assessment is in
`docs/BUILD8-FINAL-RECONCILIATION.md` and
`docs/BUILD8-CATALOG-REHEARSAL.md`. Historical rehearsals are not fresh production
compatibility evidence.

### Rollout plan, not executed

1. Before any deployment, independently reconcile the hosted migration ledger and
   catalog against the five exact file hashes in BUILD8-FINAL-RECONCILIATION.
   Record function signatures/defaults, grants, RLS, hooks, constraints and triggers.
   Assign an operator, backup/PITR recovery point and stop/rollback owner.
2. Rehearse only the reviewed SQL in a disposable environment with synthetic
   records and representative roles. Test owner get_own_profile, public username
   search, denied private fields, non-owner access, MFA AAL1/AAL2, and existing
   Stripe/manual entitlements. Do not enable Apple or exercise real billing.
3. Obtain a separate backend rollout approval for the exact SQL and catalog.
   Apply the first four candidates in documented order only in that later window:
   country privacy, opted-in MFA enforcement, StoreKit membership sources, then
   profile private-field boundary. Reconcile existing auth hooks; never overwrite
   them blindly. Do not run a blanket repository migration push.
4. Verify API/bootstrap behavior, then deploy compatible owner/username readers.
   Establish a minimum supported client version and account for already installed
   clients. Restricting private profile columns (candidate five) breaks older raw
   readers: keep it blocked until reader compatibility and a separate approval.
5. After each stage, stop on auth failures, private-data exposure, missing RPCs or
   entitlement drift. Monitor permission-denied rates, bootstrap/search errors,
   MFA failures and latency against the recorded baseline. Keep Apple disabled.
6. Failed SQL transactions roll back. For committed changes use reviewed
   compensating migrations built from the captured catalog, in reverse dependency
   order. Preserve APIs needed by released clients. Restoring broad raw SELECT or
   weakening MFA is a separate privacy/security decision, not an automatic rollback.

No production migrations, EAS builds, OTA updates, billing operations, production
configuration changes or StoreKit activation were performed by this continuation.

## Dependency decision

Expo remains SDK 54 with React Native 0.81.5. A non-force npm audit fix attempted
an extensive lockfile rewrite and peer resolution warnings; that rewrite was
rejected and the original lockfile restored. No dependency change is claimed.
The current registry has image-size 1.x only through 1.2.1; the audit identifies
that line as affected. Metro's callable v1 API prevents blindly replacing it with
v2. The proposed decode-uri-component 0.5.1 package is ESM, unlike installed 0.2.2;
a broad override is not verified compatible with the CommonJS query-string chain.
Both remain release blockers pending an SDK-54-compatible upstream fix or a
separately reviewed and tested compatible remediation. Audit counts change with
the advisory database; prior counts are historical, not current clearance.

## Validation and remaining gates

During development: root/mobile tsc pass; 27 native test files pass; 11
security/bootstrap/membership/checkout/AASA files pass; entitlement matrix passes
10 role/tier cells and 22 entitlements; lint zero errors, 125 inherited warnings.
Final-head verification results are reported separately; these development results
do not substitute for final-head browser, iOS compile, CI or Vercel evidence.

Before merging: finish and visually review all five design surfaces, resolve
compatible dependency blockers, verify the complete final-head test matrix and
branch protection requirements, and establish the separate backend release gate.
Physical iPhone interaction remains unverified on this Linux machine.
