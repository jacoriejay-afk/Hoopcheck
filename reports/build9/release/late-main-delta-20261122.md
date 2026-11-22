# Build 9 late-main website delta — isolated review only (2026-11-22)

Input development baseline `2c3b06e5409cac7edf242e4eb1477d51ff52515d`. Production main reference `7f4c61844058891ce8555c2a6d3719aea2018e99`. Compare anchored to former main baseline `896c6c608ea062e4330ca76ff5580191bcaad3df`.

## Reviewed mechanical operation

Imported thirteen **main-changed / development-unchanged paths** by exact current-main blob SHA. No development-changed file was overwritten. Did **not** import `package.json` because combined dependency/script semantics need a separate review. Did **not** touch production main, database, Stripe, Apple, EAS or protected integration.

Potentially sensitive code under review: HoopGroups controls and candidate-only SQL (marked never run on production), team-directory / career chooser, My Court CSS and role links. Source copy is not a production feature-activation authorization.

## Shared paths left untouched for actual semantic merge

- `app/account/page.tsx`
- `app/dashboard/HomeCourtSpace.tsx`
- `app/dashboard/home-court-space.css`
- `app/dashboard/page.tsx`
- `app/layout.tsx`
- `app/settings/page.tsx`

Reconcile each against source changes on both sides. Do not replace integration's native/Stripe/Apple provider-aware entitlement, role-scoped navigation, privacy/RLS, or security boundary.

## Gates

TypeScript / root CI / web build / accessibility & both themes / real browser screenshot comparison / component fixtures. Current development iOS CI-gate PR #836 remains separate and must be verified first. Do not merge this draft before resolving all six shared files and validating newly imported component contracts with the same combined head.

Production rollout PR #755 remains HOLD pending source merge, genuine Auth AAL1/AAL2 requests, production-schema-equivalent PostgreSQL 17 migration and rollback, installed-client compatibility, real iPhone/Apple Sandbox, approved signing/counter.
