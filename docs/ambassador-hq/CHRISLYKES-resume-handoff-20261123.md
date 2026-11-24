# CHRISLYKES campaign — authorized original-term resumption handoff

**Status:** Review-only. No production SQL or campaign data changes. This is separate from Build 9 release PR #755 and does not require a billable Supabase branch.

## Verified inputs (2026-11-23, read-only)

- Production grant exists, linked to an account, but is `suspended`.
- Initial activation: 2026-11-15 10:19:38.912552 UTC, with original audited 90-day end **2027-02-13 10:19:38.912552 UTC**.
- Owner audit records a deliberate `pause` on 2026-11-18 08:51:37.482277 UTC, which shortened the stored `ends_at`.
- Rates are **50% first payment / 10% recurring**, retained per attribution for 12 months after each qualifying first payment. The *suggested* 15% renewal rate is **not** an approved amendment.
- There is one captured referral and no commission or paid-payout entries as of read-only check.
- `public.ambassador_manage` currently supports `link`, `activate`, `amend`, `pause`, but **no resume** operation.
- The signed-term document says the Effective Date is the later of the last signature and written confirmation that tracking works. Do not substitute the `activated_at` database date for that missing external confirmation without checking it.

## Candidate implementation

- `supabase/candidates/ambassador_resume_signed_term.sql` adds a **new** service-role-only, empty-search-path guarded RPC, with no replace of the existing admin RPC or changes to payment/captured-referral tables.
- It restores only the prior audited **90-day** end if still in the future; rejects changed rates, missing signed terms, unmatched pause, wrong typed end date, repeat resumes and an empty reason.
- It writes a new owner audit record with the approval reason and previous/restored dates in the same SQL transaction.
- The web owner UI is disabled by default and requires the server-only `AMBASSADOR_RESUME_ENABLED=true`, an approved owner session, **AAL2 MFA**, explicit original-end-date confirmation, and written reason. There is no automatic resumption.
- The existing CHRISLYKES campaign remains suspended until that approved operation is executed successfully.

## Release gates (do not skip)

1. Verify **both actual signatures, the written tracking-live confirmation / Effective Date**, the 90-day term, and that the November 18 pause should now end. Record the reason and explicit owner approval to resume.
2. Have an authorized reviewer validate the function owner, security definer scope, service-role-only EXECUTE, exact production schema, trigger/RLS interaction, and refund/commission continuity.
3. Rehearse the exact SQL candidate with rollback on a **production-schema-equivalent PostgreSQL 17** environment; do not infer compatibility from the current divergent PR17 test project. No paid staging project/branch without separate approval.
4. Exercise approved owner vs non-owner **real signed HTTP AAL1/AAL2** requests. Confirm that service-role and AAL2 web controls both deny unauthorized access, and that direct authenticated RPC cannot be invoked.
5. Verify the server-only rollout flag and preview UI. Install the reviewed versioned migration through an **authorized migration runner**, not an ad hoc grant or bypass.
6. Only after steps 1–5, enable `AMBASSADOR_RESUME_ENABLED=true`, confirm the original end date in the owner UI and record the resumption reason. Re-read the actual grant and owner audit.
7. Test a fresh `/referral/CHRISLYKES` cookie (30-minute, httpOnly), email/Google signup, attributed first payment and 12-month tail handling; reconcile real Stripe event configuration and billing-mode safeguards. Avoid uncontrolled live charges.
8. If any check fails, keep the campaign paused and the feature flag off. Never rewrite existing referral attributions, subscription history, settled commissions or historical payment rows to 'fix' the state.

**Not a Build 9 sign-off:** production owner/profile RLS migration, existing Build 7/8 compatibility, real signed backend tests, physical iPhone and Apple Sandbox trials remain independently blocked.
