# AMB-1 Ambassador HQ

Tracked in issue #642 and PR #643. Ambassador access is separate from HoopCheck account types, memberships, and platform administration.

## Operations

- Open `/admin/ambassadors` as an approved HoopCheck owner. The Chris Lykes campaign starts reserved and inactive. Link only his verified existing HoopCheck user ID. Enter the signed agreement reference, signed date, confirmed payout terms reference, first-payment and renewal rates, and campaign length before activating. Store agreement and payment credentials in the owner's approved system. The app stores references only.
- The campaign URL is `https://hoopcheck.online/referral/CHRISLYKES`. It redirects to signup. Active visits receive a short-lived, single-use attribution token. Existing accounts cannot claim a token after signing up. Email must be verified before checkout can carry attribution. The link applies no discount.
- The existing Stripe webhook must deliver `invoice.paid`, `invoice.payment_failed`, `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`. Enable `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed`, and `charge.dispute.*` events used by the handler so the ledger reconciles after payment. Verify permissions to read invoice payments, payment intents, charges, balance transactions, and disputes in the correct Stripe mode.
- The ledger uses captured USD Stripe subscription receipts with a verifiable payment fingerprint. It subtracts sales tax and actual processing fees. Discounts are already reflected in the amount collected. Refund and unresolved or lost dispute deductions use the non-tax share of the amount. Won disputes release their hold. Zero-dollar, out-of-band, multi-tender, unsupported fingerprint, and native store payments require separate reconciliation before any commission is credited.
- The first successful qualifying payment starts a 12-calendar-month UTC window. First-payment and renewal rates are captured when a customer is referred. Closing the campaign prevents new qualifying first payments and preserves the tail on existing conversions. Record future terms changes as signed amendments. Already captured rates stay fixed.
- Owner approval groups eligible commissions after a 30-day validation period. Record the completed external transfer with its reference. If a refund changes an approved amount, cancel the approval and review the new balance before transferring. Previously settled payouts remain in history and adjustments offset future balances. Use the monthly UTC CSV to reconcile the ledger with Stripe and the transfer record.

## Deploy and verify

1. Run the isolated Ambassador SQL fixture and Stripe webhook tests in CI. Verify on the connected test project and use Stripe sandbox payments for end-to-end real event delivery.
2. Apply `20261114072000_ambassador_hq_foundation.sql` and `20261114072854_ambassador_hq_workflows.sql` in order before shipping code that calls the new RPCs. Confirm the campaign reservation exists with no grant and that transactional finance paths are service-role only.
3. Verify production routes, owner isolation, signed-out behavior, subscription checkout and dashboard rendering. Do not activate Chris's code until signed terms are confirmed.
4. If a rollback is necessary, close attribution to new referrals and retain the versioned schema and ledger. Keep processing signed refund/dispute events and existing commission windows during reconciliation. Coordinate any application rollback with outstanding referred payments.
