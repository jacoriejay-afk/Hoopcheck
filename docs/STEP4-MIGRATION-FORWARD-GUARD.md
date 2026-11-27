# Step 4: forward-only migration guard

Refs #1139. Offline preflight only. Do not run hosted SQL, repair migration history, reset a project, or commit private production migration manifests.

The migration audit found historical duplicate filename prefixes and different production ledger timestamps. Preserve existing files byte-for-byte; any intentional correction requires a separately reviewed forward migration. This tool flags edits, removals, renames, reused timestamps and new timestamps not strictly greater than both the repository and production ledger high-water marks.

Run `node scripts/step4-migration-forward-guard.mjs --self-test`. Supply two private JSON manifests: base with exactly `format: 1`, `commit` (40-character Git SHA), `files` (array of objects with `name` and Git blob `sha`, from the exact commit's supabase/migrations directory), and `ledgerVersions` (nonempty unique production version strings from a separately validated version-only ledger); candidate with exactly `format: 1`, `commit`, and `files`. Obtain the complete inventory from the pinned Git tree, including all historical files; independently validate its completeness, ledger freshness and provenance. No statement bodies or user data. Run:

`node scripts/step4-migration-forward-guard.mjs /private/base.json /private/candidate.json`

Exit 0: structural forward-only check passed; 1: historical changes or new timestamp violations; 2: invalid input. Existing duplicate prefixes are reported, not silently fixed. A pass never establishes full schema parity, migration equivalence, or permission to replay. It does not verify manifest provenance, completeness, or actual migration order; the reviewed baseline, explicit schema and role coverage, and disposable PG17 recovery acceptance remain mandatory. No deployment or provider activation.
