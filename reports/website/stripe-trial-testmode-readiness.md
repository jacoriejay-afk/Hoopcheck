# Seven-day Player trial — isolated Stripe test-mode readiness

Status: PREPARED, NOT ENABLED. This document is a verification plan, not proof of completed checkout tests.

## Hard release boundaries

- Keep `const trialRolloutEnabled = false;` in the production checkout handler. Do not change this to a generic environment flag: Vercel previews can share production Stripe credentials and backend settings.
- No live Stripe checkout, test-to-live key substitution, production Supabase migration, or live trial activation.
- Test only with independently verified `sk_test_` Stripe credentials, matching test-mode webhook signing secret, and the isolated test Supabase project. Never print or store credentials in logs or artifacts.
- Confirm Stripe Tax test-mode configuration, test price IDs, webhook endpoint, and tax address collection before initiating any checkout.
- Verify test Supabase has reviewed trial claim schema and owner-scoped reservation/binding/redeem functions. If missing, stop; do not weaken RLS or borrow production RPC access.

## Required integration cases (not yet executed)

1. Verified new Player, monthly Pro: first trial checkout returns 7 trial days, correct test-mode price and tax collection; initial charge and next billing date are clearly shown by Stripe.
2. Verified new Player, monthly Premium: same checks for Premium price.
3. Fan, Coach, and nonmonthly Player: no trial.
4. Unverified email, existing or canceled subscription, duplicate Stripe customer history, and truncated customer lookup: no trial.
5. Promotion code or free-month offer: no trial stacking; normal promotion eligibility remains intact.
6. Concurrent checkout requests for the same user: only one reserved claim and one usable session. A duplicate may reuse only a verified bound session with matching user, plan and term.
7. Abandoned/expired session: recovery leaves a terminal claim; it must not reset one-time eligibility.
8. Successful checkout webhook: verify signed event, owner metadata, bound claim redemption before entitlement write; retry and out-of-order events remain idempotent.
9. Test Clock renewal after day seven, cancellation before renewal, tax totals, refunds and subscription portal behavior.
10. Existing Premium subscriber: no new trial; access and renewal unchanged.

## Evidence required for sign-off

Record test-mode Checkout Session IDs, event IDs, test customer/subscription IDs, redacted screenshots of Stripe-hosted price/tax/renewal disclosures, request timestamps, test-mode webhook outcomes, and CI run links. Do not store email addresses, payment data, or secrets. Verify no test-mode object is linked to a production user.

## Release decision

HOLD until the isolated test-mode lifecycle and atomic reservation tests are evidenced, and the owner separately approves a reviewed production rollout. Current UI explicitly states the seven-day trial is not currently available at checkout; the server-side rollout flag remains hard-disabled.

## Read-only Stripe test-mode inspection — 2026-11-21

Account: hoopcheck.online, `livemode=false`. No Stripe objects were created or modified.

- Stripe Tax settings report `active` with default `inferred_by_currency` tax behavior.
- Test-mode Tax registrations list returned **zero** registrations. Automatic Tax enabled on Checkout is not proof of actual collection. Stripe Tax collects no tax in a jurisdiction until a registration exists there. Do not invent a tax registration based on the business address.
- Active monthly test prices include Player Pro **USD 4.99** and Player Premium **USD 9.99**; other active test prices exist. Confirm exact server-side price-ID mapping before checkout.
- Several test webhook endpoints exist, including enabled endpoints covering checkout completion and subscription updates. Their presence does not establish delivery, correct signing secret, or receipt by the intended isolated deployment. Do not reproduce webhook bypass URLs or secrets in reports.
- Existing test Checkout Sessions include completed and expired sessions, but do not demonstrate a seven-day trial or successful trial claim redemption.
- Source review confirms `trialRolloutEnabled = false`, a draft trial claim migration, and local eligibility/recovery test scripts. The SQL is a **proposal only** and must not be assumed installed in the isolated database.

**Decision:** Test-mode configuration inspected; trial integration NOT yet executed or accepted. The hard-disabled live gate remains intact.

## Isolated Supabase read-only verification — 2026-11-21

Inspected only `HoopCheck-PR17-Test` (project `vcprqpjkyubzzcjatdpx`), **not** the production project. No SQL writes, migrations or grants.

- `public.stripe_trial_claims` exists; RLS enabled; `anon` and `authenticated` lack SELECT; `service_role` has INSERT.
- `reserve_stripe_trial(uuid)`, `bind_stripe_trial_session(uuid,text)`, `redeem_stripe_trial(uuid,text)`, and `mark_expired_stripe_trial(uuid,text)` exist.
- All four functions are SECURITY INVOKER (not SECURITY DEFINER), executable by `service_role`, and not executable by `anon` or `authenticated`.
- This establishes object presence and privileges only. No trial claim writes, real authenticated checkout, signed webhook delivery, concurrent reservation race, or Test Clock lifecycle has been executed.

**Next gate:** review installed function definitions against the proposed SQL and validate isolated checkout/webhook routing and secret configuration before generating test transactions. Keep live rollout hard-disabled.

## Installed function-definition comparison — 2026-11-21

Read-only `pg_get_functiondef` inspection of the isolated test project found all four installed functions equivalent in their PL/pgSQL bodies to `scripts/sql/stripe-trial-claims-proposal.sql`:

- `reserve_stripe_trial`: inserts once using `ON CONFLICT DO NOTHING` and returns whether inserted.
- `bind_stripe_trial_session`: rejects missing/non-`cs_` IDs, updates only reserved claims, and does not replace an already different session.
- `redeem_stripe_trial`: transitions only a matching reserved claim; a duplicate event for the same already-redeemed session is idempotently accepted.
- `mark_expired_stripe_trial`: transitions only a reserved claim bound to the exact session to terminal expired state.

The installed functions use empty search paths and SECURITY INVOKER (as confirmed by `prosecdef=false`); RPC execution remains restricted to `service_role`. Formatting and dollar-quote labels differ, not the reviewed logic. This is a **source/installed definition review**, not a behavioral or concurrency test.

Next required: confirm sandbox webhook routing and signing-secret configuration without exposing secret values; run actual isolated claim and signed-event tests only after endpoint/backend binding is confirmed.

## Final-head automated verification — 2026-11-21

PR #758 code head `c98351f8950156f9a113f0a1a518cb46b8b24503`:

- HoopCheck CI **SUCCESS** — run [44938256454](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44938256454). Includes isolated trial reservation, trial release-safety, eligibility, fail-closed recovery, membership selection, web build, and browser theme regressions.
- VERIFY-1 entitlement matrix **SUCCESS** — run [44938256529](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44938256529).
- Launch Test Final Gate **SUCCESS** — run [44938256495](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/44938256495).
- Five Vercel commit statuses **SUCCESS**, including the sandbox preview; branch remains draft/unmerged.

Stripe has no enabled test webhook destination pointing to this PR's current preview. Do not reuse older ephemeral endpoint secrets or expose deployment-protection bypass tokens. A verified, signed, authenticated end-to-end checkout remains untested. **Release decision remains HOLD.**
