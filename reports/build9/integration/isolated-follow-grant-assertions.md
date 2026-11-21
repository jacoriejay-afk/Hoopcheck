# Build 9 follow-table grant assertions — isolated rollback rehearsal

On 2026-11-21, ran the exact current `supabase/candidates/build9_follow_relationships_prerequisite.sql` on isolated project `vcprqpjkyubzzcjatdpx`, with additional in-transaction assertions before its final ROLLBACK.

Verified without reported SQL error:
- `authenticated` has SELECT, INSERT, UPDATE, DELETE table privileges.
- `anon` has no SELECT table privilege.
- Exactly one `followers manage own` ALL policy exists for the new table in the transaction.
- The transaction ends with ROLLBACK.

These assertions validate the catalog-level permission shape **only**. They do not prove row-level access behavior under actual user JWTs, role-switch behavior, live client API behavior, or downstream follow/privacy RPC compatibility. No hosted schema changes persisted. Protected profile function owner handoff remains unresolved.

Latest-head GitHub CI was in progress at the time of inspection; do not infer a pass.
