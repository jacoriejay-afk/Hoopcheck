# Verified sponsor inquiry audit — 2026-11-09

Production Supabase project: HoopCheck (project ref ucbdceaieyenljcwlhnj).
Read-only SQL inspection performed; no schema changes.

## Existing table
public.sponsor_inquiries columns:
- id uuid NOT NULL
- user_id uuid nullable, FK to profiles(id), ON DELETE SET NULL
- type text NOT NULL
- message text NOT NULL
- created_at timestamptz NOT NULL

Type constraint currently permits only sponsor, donate, inquire.

## Access
- RLS enabled.
- One INSERT policy for authenticated users: user_id = auth.uid().
- No SELECT/UPDATE/DELETE policies were returned. RLS therefore blocks ordinary clients from reading/updating/deleting rows, even though role grants exist.
- anon has SELECT grant, but no RLS SELECT policy.
- authenticated has SELECT, INSERT, UPDATE, DELETE grants; INSERT is restricted by the existing policy. Minimize grants in a separately reviewed migration if compatible with other application code.
- service_role has broad privileges, as expected for privileged server workflows; do not expose it to clients.

## Implications
- Existing /partners client form can submit only after authentication.
- Existing types must be preserved for backward compatibility.
- Investor, ambassador, and strategic inquiry types require a reviewed constraint migration before UI support.
- Current UI does not provide a private admin inbox or distinct investor data handling.
- Existing production table should be reused or migrated carefully; do not create a competing inquiry store without need.
- Do not treat this inspection as an end-to-end submission test.

## Proposed next work
1. Inspect all readers/writers of sponsor_inquiries and identify the admin authorization model.
2. Draft additive schema migration for type expansion, status, and contact details, with RLS review.
3. Implement validation and anti-abuse controls, privacy notice and consent.
4. Verify a real signed-in insert and a denied anonymous insert in a test environment.
5. Build admin-only review workflow, then perform production smoke tests.
