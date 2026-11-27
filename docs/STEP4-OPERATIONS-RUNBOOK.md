# Step 4: operational release readiness

Refs #1139, #1137, #1138, #1006, #1073 and #1075. This is a review-only operational runbook. No production, hosted database, EAS, store, billing or paid service actions are authorized.

## Launch control
Pin the candidate commit, native build identifiers, environment and observation time. Run the release-evidence checker against a private, redacted evidence manifest. Never store access tokens, raw customer data, payment details or signed media in evidence. A passing manifest is a structural check, not independent verification or release approval. A reviewer must open every evidence link, check exact source/build, coverage and outcome. Reuse Owner HQ release observations for aggregate regression signals; a quiet metric is not proof of readiness.

## Incident and rollback
1. Record UTC time, affected platform, exact deployed version, symptoms and scope. Categorize P0 (auth/security/data loss/billing), P1 (major function unavailable), P2 (degraded/noncritical). Hold rollout on P0/P1.
2. Preserve redacted logs and evidence; never paste tokens or customer records. Identify whether code, provider, configuration or database is implicated. Notify owner and designate a single incident coordinator.
3. Inventory existing emergency flags and their actual server enforcement. Only an approved operator may change an existing flag after recording previous value, scope, reason, expected impact, expiry/review time and rollback. Never disable authorization or moderation to restore functionality.
4. Before a rollback, check schema/API compatibility with old signed clients, migration reversibility and billing/webhook idempotency. Roll back code only if compatible; otherwise prefer an reviewed forward repair. Never restore a production database or reverse a destructive migration without separate authorization and rehearsed recovery.
5. Verify affected flows, monitor recovery and document timeline, root cause, follow-up and owner sign-off. No automatic production mutation.

## Backend hygiene and restore drill
- Inventory tables, views, functions, grants, RLS, indexes, storage policies, scheduled jobs, API dependencies and provider rights. Use source references, migration history and bounded catalog/statistics queries. Low traffic is not proof of disuse; retain unknown objects and legacy client dependencies. Do not delete or mutate production.
- Rehearse only on an isolated disposable full-schema database with synthetic records: capture schema/migration versions, seed representative users/roles and membership states, export and restore, compare counts and constraints, verify auth links, access denial, private storage references, billing/event deduplication and migration compatibility. Record elapsed recovery time and tested data-loss window; never claim an RPO/RTO from an unrun drill. Redact outputs; remove temporary data after rehearsal.
- A source audit or fixture does not prove hosted backup availability, actual recoverability or production parity.

## Smoke and reliability coverage
Use local or explicitly approved isolated endpoints only. Verify public routes and authorized private routes with synthetic accounts for each role/tier. Include signup/recovery, Owner HQ denial, feed/group/chat/report/block, media permission and interrupted upload retry, directory paging, billing sandbox and notification delivery. Negative cases: offline, provider timeout, duplicate submission, stale session, rate limits and cross-account access. Bound timeouts/concurrency; never stress production. Record statuses without request bodies, tokens or user identifiers. Native physical-device, signed links and store sandbox evidence are separate gates.

## Operations handoff
Track cost signals and notification/media provider delivery using existing telemetry, no new paid services. Unknown values remain unknown. Audit retention/expired-media cleanup with dry-run only; audit accessibility (VoiceOver/TalkBack, larger text, contrast, reduced motion), older OS compatibility and beta support escalation. Owner approval is required for rollout, deployment or store submission. All outstanding #1139 implementation gaps remain open until proven on the exact candidate.

Run `node scripts/step4-release-evidence.mjs --self-test` and `node scripts/step4-release-evidence.mjs /private/path/manifest.json`. Required gates: ci, security, schema_restore, web_smoke, ios_signed, android_signed, billing, operations. Evidence must match the candidate SHA and signed build, be reviewed within seven days, and link to the HoopCheck repository. The checker does not verify remote links or sign-off authenticity.
