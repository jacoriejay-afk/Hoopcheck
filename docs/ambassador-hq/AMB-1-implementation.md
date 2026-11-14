# AMB-1: Ambassador HQ implementation contract

Issue: #642. Status: design only; no feature is live.

## Confirmed existing integration points (main, 2026-11-14)
- `lib/membership-tier.ts`: existing centralized membership entitlement resolver. Ambassador status must be separate from account type and subscription tier.
- `app/api/stripe/webhook/route.ts`: existing subscription webhook. Integrate commission recording only after verifying existing event idempotency and payment event semantics.
- `app/business-opportunities/page.tsx`: existing athlete ambassador inquiry copy; not an active ambassador portal.

## Planned data model
1. `ambassador_grants`: user_id unique, status (pending/active/suspended), code unique case-insensitive, agreed_rate_bps nullable, agreement_signed_at nullable, owner approval audit fields. Never infer grants from editable profiles.
2. `ambassador_attributions`: ambassador_id, referred_user_id unique, source and capture timestamp, immutable after first verified attribution; self-referral disallowed.
3. `ambassador_commissions`: ambassador_id, attribution_id, Stripe invoice ID unique, subscription ID, first_paid_at, paid_at, gross_minor, net_minor, rate_bps, commission_minor, status, reversals, created_at. Enforce 12-month eligibility measured from first successful customer payment, not campaign end.
4. `ambassador_payouts` and payout line items: owner-approved manual settlement with audit history. Never store bank details in application tables.

## Security and business constraints
- Database RLS: ambassador reads only own grants, aggregate attribution counts and own ledger; no customer emails or Stripe secrets. Service role writes only through verified backend paths.
- Stripe invoice processing: idempotent by invoice/event identity; account for taxes, discounts, fees and refunds per signed definition of net revenue. Refunds/disputes create audited reversal, not destructive edits.
- Do not change subscription pricing, tier resolver, or other role permissions.
- Chris Lykes code `CHRISLYKES` is proposed, not provisioned; no commission percentage or automatic payout until contract signed and approved.
- No production migration or activation before test coverage and owner confirmation.

## Sequence
A. Inspect existing auth, signup, checkout, webhook, migrations and RLS conventions.
B. Add versioned migration, role checks and unit/RLS tests.
C. Add server-side referral capture and invoice-based commission processing.
D. Add responsive /ambassador-hq and owner controls.
E. Test paid signup, renewal, upgrade, cancellation, refund, webhook replay, expired eligibility and cross-account access.
F. Run TypeScript and both CI workflows; preview QA in both themes; merge/deploy only after passing verification.

## Acceptance
- One commission per eligible paid invoice and no duplicate on replay.
- All payouts are owner-approved; no access to another ambassador's records.
- Existing subscriptions, roles and pricing unchanged.
- Live activation explicitly gated on signed agreement and confirmed rate.
