# HoopCheck™ Build 9 — release candidate preflight

**Updated:** November 23, 2026. **Status: PREPARATION / HOLD** for the signed iOS Store build, TestFlight and production rollout. This file is a dated evidence snapshot, not live Auth or Apple acceptance.

## Verified source and build identity

- Native source: `integration/build9-backend-completion-20261121`, release PR [#755](https://github.com/jacoriejay-afk/Hoopcheck/pull/755) remains **draft / unmerged**. Production main at inspected SHA `04b2fb6c` was reconciled into development by [PR #875](https://github.com/jacoriejay-afk/Hoopcheck/pull/875); later GitHub comparison showed **zero behind** main. Technically mergeable means only source history reconciles; it is not release approval.
- Expo app ID: `62f822cb-ab9a-42ba-8456-007d2822ef70`; iOS bundle in config `online.hoopcheck.app`; App Store Connect ID `6835366982`. EAS `requireCommit=true`, `appVersionSource=remote`, production `autoIncrement=true`.
- Latest completed EAS iOS **Store** build: **0.2.0 (8)** at `c0b77ba3e7de5beb88cd588a8cfe506bec315e2b` (Nov 19). That binary is **not** Build 9. A prior Store Build 7 existed with a different historical client hash. The next numeric counter must be checked in EAS/ASC rather than assumed.
- #808 integrated personalized role HQ, HoopChat, HoopBot, HoopGroups separation, live game/league discovery, and current Arena navigation. [PR #813](https://github.com/jacoriejay-afk/Hoopcheck/pull/813) merged the startup-interruption and Passport smoke implementation. [PR #836](https://github.com/jacoriejay-afk/Hoopcheck/pull/836) merged an exact-head native verification gate; [unsigned simulator workflow 45005943667](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/45005943667) passed real Passport PDF, sharing, and cleanup tests. #814 and #815 closed without a separate merge. This evidence closes the **startup/Passport feature gate only**; latest-head simulator, real device, and Apple Sandbox still require their own acceptance.
- Website `hoopcheck.online` was READY at latest verified check, but website production verification does not establish an iOS release pass.

## Backend / privacy release gate

- Production Supabase project `ucbdceaieyenljcwlhnj` has a different migration, role, function-owner and RLS history from the isolated PG17 test fixture. The repo contains [PR #876's installed Store Build 8 source-to-contract audit](https://github.com/jacoriejay-afk/Hoopcheck/pull/876); that exact committed read-only query confirmed production lacks the required native owner RPC, despite other Store Build 8 public RPCs being present. Do not use the isolated fixture as a production-parity substitute.
- Protected `public.get_own_profile()` and opt-in MFA helper still **absent from production**. #812 prepared a scoped candidate and its synthetic PostgreSQL tests, **not a live migration or genuine signed authentication acceptance**.
- Direct `public.profiles.current_country` SELECT is still granted to both `anon` and `authenticated`. Phase-2 REVOKE would risk older Build 7/8 profile clients; do not apply until compatibility, schema-equivalent PG17 rehearsal and real signed HTTP AAL1/AAL2 acceptance pass.
- Keep Apple/Stripe subscriptions, existing data, RLS and protected function ownership unchanged unless verified new migration and rollback review authorizes a safe step.

## Gates and commands

The authoritative **snapshot checklist** is `reports/build9/release/build9-gates.json`. The machine-readable checker lives at `apps/mobile/scripts/check-build9-release-readiness.mjs`.

From `apps/mobile` run:

```sh
node scripts/check-build9-release-readiness.mjs
node scripts/check-ios-release-identity.cjs
# The following is intentionally a hard FAIL until *all* attested gates pass:
node scripts/check-build9-release-readiness.mjs --release
```

The identity script requires `HOOPCHECK_APPROVED_IOS_BUNDLE_ID` **after** independent Apple confirmation; don't set it just to make checks green. `--release` additionally requires an explicit 40-character `BUILD9_RELEASE_COMMIT` that matches the reviewed manifest. The manifest never contains JWTs, Apple passwords, DB connection strings or EAS credentials. Keep real signed-HTTP test tokens ephemeral, do not publish test account data.

The readiness script checks local app/EAS configuration and native routes. It **cannot itself prove** iPhone, Auth/MFA, Apple Sandbox or production DB tests; signed/physical evidence must be reviewed and the manifest updated with external links/commit.

**Remaining release sequence:** confirm all six workflows on the **actual final integration SHA**, including unsigned Passport iOS tests -> rehearse **production-equivalent** PG17 owner/MFA/privacy migrations with rollback, authorized function ownership and redacted real signed owner/non-owner AAL1/AAL2 HTTP evidence -> verify installed Store Builds 7 and 8 on devices -> complete physical Build 9 iPhone, StoreKit Sandbox purchases/restore/renewal/refund, theme and sharing acceptance -> verify Apple signing/bundle/next build counter -> explicit owner release sign-off -> optionally trigger **one** approved iOS EAS build with `autoSubmit=false`. Do not submit automatically.
