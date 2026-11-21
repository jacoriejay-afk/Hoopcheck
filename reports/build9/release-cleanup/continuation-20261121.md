# Build 9 continuation — release HOLD

Fetched integration branch at `1ffaa7b2cbf5435cb2a66dc14c8720b759574163`, newer than b26156af. PR #755 remains draft. This report supersedes the prior report's four-price correction blocker; its hosted acceptance limits remain in effect.

## Stripe test catalog reconciliation

Fresh reads of acct_1ULNpCPfOHVXLGd2, explicitly livemode=false, confirmed both monthly prices and four stale term prices. Created only four replacement test prices. Read-back confirmed all four active, USD licensed recurring, exact approved lookup keys, amounts and intervals. Original prices remain untouched for historical subscriptions. No subscription, payment, refund, commission, production price or live billing writes.

| Membership | Approved | Prepared test Price ID |
| --- | ---: | --- |
| Pro month | $4.99 | price_1UQT7DPfOHVXLGd245gLa1l3 |
| Pro 6 months | $26.95 | price_1UeEymPfOHVXLGd2HUvg5zkF |
| Pro year | $50.90 | price_1UeEyqPfOHVXLGd2cf6RDYJU |
| Premium month | $9.99 | price_1UQT7xPfOHVXLGd2sr4WVG6I |
| Premium 6 months | $53.95 | price_1UeEysPfOHVXLGd2iSGNcV26 |
| Premium year | $101.90 | price_1UeEywPfOHVXLGd2MbOLF7pP |

Replaced for new test checkout: Pro price_1UQT7LPfOHVXLGd2lHGbiY1o ($25.45), price_1UQT7vPfOHVXLGd27U23LzyF ($53.89); Premium price_1UQT7zPfOHVXLGd2JEj6uJ24 ($50.95), price_1UQT81PfOHVXLGd2BDBotjwN ($107.89). Checkout resolves approved lookup keys with amount/currency/recurrence validation. Replacement metadata explicitly supplies plan and billing_interval for webhook fallback. Existing environment mappings require the prepared `stripe-test-bindings.env.example`; hosted secrets were not changed or verified. Existing subscriptions must retain their original mappings/metadata.

Tax settings read-back: active, default inferred_by_currency, generic account default classification; no active test registrations. Replacement prices preserve that default. No tax settings, product classification or registrations changed. Non-trial checkout still omits automatic_tax; trial rollout remains held. Tax jurisdiction/classification confirmation and real tax/payment/refund/commission acceptance remain release gates. Fixture coverage of monthly seven-day eligibility, history/recovery, refunds and Ambassador adjustments is not hosted acceptance.

## Separately reviewed Phase 3d

Compared all six extra commits through 89dd90ce. Selected only the completed default-off roster/career contract gate and no-read React regression from that branch. Ordinary builds no longer call undeployed roster/history/statistics candidates. Synthetic browser export explicitly opts into candidate contracts to preserve existing fixture coverage; this is not backend authorization. Other league-season, owner-affiliation, UI-test and hosting changes remain separate pending full integration review. No Phase 2 redesign changes or fabricated statistics.

Home, feed/posts/comments/reactions/polls/media/sharing, games/chat, groups, profile/editing, Passport, search/directories and membership retain the inherited native/server/browser contract coverage. Hosted feature acceptance remains blocked on schema reconciliation and real sessions. No claims of production or physical-device acceptance.

## Security and dependencies

Scoped function ownership, OID, ACL, SECURITY DEFINER, empty search_path and protections are unchanged. No migrations applied. The owner-capable authorized migration runner requirement remains mandatory; see scoped-profile-reconciliation.md. Reconcile canonical follow relationship and profile-lock baseline, then repeat hosted owner/non-owner AAL1/AAL2 and editor matrix. Do not grant membership, force ownership or bypass RLS to unblock it.

Fresh npm audits of both root and mobile locked trees report zero vulnerabilities at every severity. No dependency changes needed; Expo 54 and React Native 0.81.5 preserved.

## Verification and external gates

New gate regression passes. Final local results and exact-head six-workflow results are recorded in the PR continuation comment after execution. Linux cannot compile Xcode; unsigned iOS compilation uses the existing macOS GitHub workflow, never EAS.

Physical iPhone: signed binary/version/build identity, cold/relaunch/background/account switch, MFA, all feature journeys, PDF export/share/cancel/cleanup, accessibility, keyboard, offline and retry. Apple Sandbox: tester and product identity, seven-day eligible monthly trial/exclusions, all six terms, purchase/renew/cancel/expire/refund/revoke/restore/reinstall, account ownership, duplicate/out-of-order notifications, server entitlement and Ambassador adjustments. Authenticated Apple/Expo signing/counter evidence and these external-device tasks remain outstanding. No merge, deploy, production migration, live billing change or EAS start.
