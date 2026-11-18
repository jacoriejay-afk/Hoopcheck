# Current ambassador ledger verification

The isolated CI harness previously loaded only the foundation and workflow
migrations. Its successful payout tests therefore did not verify the newer owner
actor guard or individual refund audit. The harness now loads both migrations and
uses a minimal private owner registry with synthetic identities, inside its
existing rollback-only transaction. No runtime or migration source is changed.

New checks cover:

- Non-owner and null actors cannot approve, settle or cancel; denied calls create
  no payout/history entries. The registered owner still completes the established
  30-day eligibility/refund-adjustment/cancel/reapprove/settlement lifecycle.
- Multiple refund identities, pending-to-succeeded updates and replay remain two
  receipts. Conflicting charge, amount, currency or Stripe timestamp cannot replace
  immutable evidence. Unattributed charges are ignored; invalid fields are denied.
- Client roles lack audit SELECT/INSERT and RPC execution. A non-service claim is
  rejected inside the function too. Service execution and audit-table RLS remain.
- Recording receipt audit leaves every commission field unchanged; cumulative
  deductions and payout calculations stay in their separate reconciliation path.

## Local evidence — 2026-11-18

Official PostgreSQL 16 Alpine ran in a disposable container with networking disabled,
no published ports and no hosted credentials. The complete fixture passed twice.
Omitting the owner-guard include failed at the expected `Non-owner payout action
unexpectedly succeeded` assertion. After rollback, both commission and owner-registry
tables were absent. Container and downloaded image were removed. An initial larger
image hit the workspace disk limit; it was not used as verification evidence.

## Deployment state is separate

Read-only production metadata showed the service-only payout RPC still used the
earlier function body, without the newer actor check. Anon/authenticated cannot
execute it; the server action independently calls `requireAmbassadorSession(...,
true)` and supplies the verified owner ID. The canonical owner check delegates to
the private owner registry used by the newer guard. No production records or
payout operations were used to test this finding. Loading the guard in CI does
not deploy it to any hosted project; database deployment status must be verified
separately. Do not report a checked-in migration as proof of its deployed body.
