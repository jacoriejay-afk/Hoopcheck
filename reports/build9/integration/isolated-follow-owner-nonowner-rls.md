# Build 9 authenticated-role RLS behavior — isolated rehearsal

Executed on isolated HoopCheck-PR17-Test (`vcprqpjkyubzzcjatdpx`) on 2026-11-21.

Within the current follow-table candidate's `BEGIN` transaction, selected two existing test profile UUIDs without exporting them, generated a random team target UUID, and used `SET LOCAL ROLE authenticated` plus `set_config('request.jwt.claim.sub', ..., true)` to simulate each profile. Inserted a follow for the first profile; asserted the first profile could read it. Switched the simulated claim to the second profile; asserted it could not read the record, and its UPDATE and DELETE affected zero rows. Finished with `ROLLBACK`.

First test attempt had a SQL syntax error in an UPDATE-in-FROM assertion and did not execute. Corrected it to use `GET DIAGNOSTICS ... ROW_COUNT`; the second run completed without reported SQL error. Independent post-query confirmed `to_regclass('public.follow_relationships')` remained NULL.

**Limitations:** Database role and session-claim simulation, not a signed/verified Supabase JWT or real HTTP request. Existing profile IDs were used only inside the rolled-back transaction. This does not establish that installed Build 7 clients, downstream follow RPCs, profile privacy, or AAL1/AAL2 endpoints work.

No persistent test database changes, production changes, migrations, merges, deployment or EAS.
