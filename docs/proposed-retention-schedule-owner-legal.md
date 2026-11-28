# Proposed retention schedule — owner and legal approval required

QA-only proposal. No policy approval, purge scheduling, worker activation or migration repair is authorized. Preserve existing rights and approved deletion/export controls. Durations below are proposed operational targets, not statements of legal requirements. Counsel must resolve applicable jurisdictions, lawful basis, payment/accounting rules, limitation periods and provider contracts before any implementation is activated.

| Category | Proposed trigger and maximum ordinary retention | Disposition |
|---|---|---|
| Account/profile, auth sessions, device tokens | verified deletion request; target completion within 30 days | revoke access promptly; erase identifiers and provider copies; exceptions separately recorded |
| Private chat, group membership, drafts and media | verified deletion request; target 30 days for identity-linked copies | erase or remove identity where third-party rights permit; review shared messages separately |
| Approved team reviews and trust facts | 12 months from account deletion, only if approved and re-identification risk cleared | rotate IDs, remove author/text/season, month-bucket dates, retain minimal rating and target; otherwise erase or route to authorized review |
| Unapproved/reported reviews and moderation evidence | 90 days after case closure, subject to documented hold | restricted access, minimize, erase when cleared; never automatically retain identifying review content |
| Security and access logs | 90 days from event | minimize identifiers, restrict access, erase |
| Export downloads and transient processing files | 7 days from creation or sooner after delivery | expire links, erase artifacts and provider copies |
| Billing, tax, commission and dispute records | proposed 7 years after relevant financial period closes, subject to jurisdiction-specific counsel decision | retain only required fields with restricted access, no authentication reuse |
| Deletion receipts | proposed 12 months after completion | count-only or minimal proof, no source content; assess required identifiers separately |
| Backups | proposed 30 days from backup creation, subject to actual provider capabilities | expire on rotation; restored data must reapply deletion tombstones before availability |
| Legal holds | until documented release and separate disposition | case-scoped, access-limited, periodic review; no automatic purge |

## Approval and safeguards
- Bind approved policy version, exact inventory digest, candidate SHA, jurisdiction, basis, expiry action, owner and independent legal/operational signoff. Unapproved rows remain blocked. A hold must supersede all scheduled actions; expiry rechecks live holds and dependency graph under lock.
- Preserve existing default-off review retention and expiry switches in the review-only candidate. No scheduler registration, provider activation, legal approval seed, or automatic worker retry into an unapproved purge path.
- Use explicit request fencing, scope digest, authorization, transaction boundaries, idempotent count-only receipts, and provider confirmation. Fail closed on schema drift, stale scope, unknown dependencies, shared content, third-party rights, incomplete provider receipt or ambiguous identity.
- Review rare rating/target combinations and historical linkage; do not claim irreversible anonymity. Trust score recency changes and re-registration implications require approval. Deletion must not be deemed complete while held or failed dependencies remain.
- Apply existing inventory-driven preflight for every direct FK, identity-like column, recursive cascade, polymorphic reference, snapshot, media provider, billing/commission, legal hold and receipt. This schedule is not a completed per-object policy decision file.

## Acceptance test specification (not executed by this document)
1. Default flags off; anonymous, authenticated, service role without valid approval, and scheduler attempts cannot purge or retain.
2. Missing/stale approval, version mismatch, digest mismatch, expired approval and wrong fence reject with zero mutations.
3. Legal hold created before or during operation blocks it; hold release requires independent authorization and fresh scope.
4. Unknown FK/polymorphic/provider dependencies, duplicate women review targets and unresolved moderation block entire batch; no partial deletion.
5. Both review tables: approved records only, rotated identifiers, removed author/body/title/season, month bucketing, minimal ratings, active author uniqueness, unchanged count until separately approved expiry; no mapping retained.
6. Expiry boundary UTC, no early deletion, concurrent retry deduplication, legal hold and new dependency rejection, exact expiry authorization, count-only receipts.
7. Auth/session revocation, storage permissions, export expiry, provider failure/retry and restoration tombstones; no false completion.
8. Step 1 and Step 2 baseline regression suites, populated disposable PG17 rehearsal and rollback verification against reviewed baseline; confirm unchanged RLS/ACL, functions/triggers/storage and data invariants.
9. Independent owner and legal policy approval plus operational provider retention capability evidence; no automated purges until separate explicit activation approval.
