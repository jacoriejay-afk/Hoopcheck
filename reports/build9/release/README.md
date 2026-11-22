# HoopCheck™ Build 9 — release candidate preflight

**Updated:** November 22, 2026. **Status: PREPARATION / HOLD** for a signed iOS Store build and TestFlight. This file is a historical snapshot and does not run live API checks.

## Verified source and build identity

- Native source: `integration/build9-backend-completion-20261121`, PR [#755](https://github.com/jacoriejay-afk/Hoopcheck/pull/755), draft and currently **not mergeable** to `main`. GitHub comparison at inspection: **230 commits ahead / 21 behind** main. Do not force-update the branch or replace the protected backend to resolve conflicts.
- Expo app ID: `62f822cb-ab9a-42ba-8456-007d2822ef70`; iOS bundle in config `online.hoopcheck.app`; App Store Connect ID `6835366982`. EAS `requireCommit=true`, `appVersionSource=remote`, production `autoIncrement=true`.
- Latest completed EAS iOS **Store** build: **0.2.0 (8)** at `c0b77ba3e7de5beb88cd588a8cfe506bec315e2b` (Nov 19). That binary is **not** Build 9. A prior Store Build 7 existed with a different historical client hash. The next numeric counter must be checked in EAS/ASC rather than assumed.
- #808 integrated personalized role HQ, HoopChat, HoopBot, HoopGroups separation, live game/league discovery, and current Arena navigation. #813/#814/#815 are separate overlapping startup/Passport verification PRs; use unsigned iOS simulator evidence before merging a reviewed combination.
- Website `hoopcheck.online` was READY at latest verified check, but website production verification does not establish an iOS release pass.

## Backend / privacy release gate

- Production Supabase project `ucbdceaieyenljcwlhnj` contained **200 migrations**, two restored Build8 public read-only RPCs and three private-country-masked legacy RPCs at inspection.
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

**Recommended sequence:** reconcile safe latest `main` deltas -> merge tested startup/Passport repair after unsigned iOS evidence -> run full exact-head browser/native/iOS CI -> rehearse authorized backend privately with redacted real signed HTTP evidence -> physical iPhone + StoreKit sandbox acceptance -> verify Apple credentials/remote build counter -> owner release sign-off -> optionally trigger **one** production iOS EAS build with `autoSubmit=false`. Do not submit automatically.
