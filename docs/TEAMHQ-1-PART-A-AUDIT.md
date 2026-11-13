# TEAMHQ-1 Part A — main-branch audit (2026-11-13)

Scope: code inspection, **not** runtime or production proof.

## Existing features to retain
- `app/team-dashboard/page.tsx` is the current manager landing page. It queries `profile_claim_requests` for the signed-in requester, team entity type, and approved status, then loads those teams.
- The dashboard publishes official team updates through `/api/team-fanfeed`, lists the manager's own posts, and shows fan-group summary, open reports, and pending join requests.
- `app/team-hub/page.tsx` is the **fan** hub and must not be replaced by the manager HQ.
- Existing group routes and APIs include `app/team-hub/groups/[teamId]/page.tsx` and `app/api/fan-groups/route.ts`; reuse only after checking server-side claim scoping.
- Existing team profile routes include `app/teams/[id]/page.tsx`; manager affordances must be additive.

## Verified code-level gaps
- The dashboard currently gates entry on `profiles.account_type` being coach/manager/club_admin/admin. This is **not** sufficient club-scoped authorization and also incorrectly ties manager entry to a global role.
- The dashboard infers managed clubs from approved `profile_claim_requests` client-side. Every HQ mutation still needs a trusted server-side check against an approved claim or the future invited-manager grant.
- No audited, seven-day invited-manager role or ownership-transfer flow was established in this audit.
- Existing dashboard is **not** yet the requested verification inbox, seasonal roster editor, review-reply inbox, profile editor, or unified needs-attention queue.
- SEASON-1 and SUB-1 Part C must be verified on main before relying on their schema and resolver. Do not invent season windows or paid access.
- No production screenshots, tsc result, or CI result established.

## Security contract for implementation
1. Owner rights derive from a verified approved club claim, not `profiles.account_type` or `admin_roles`.
2. Invited managers receive explicit club-scoped grants, excluding staff management and ownership transfer.
3. Every API mutation checks club scope server-side; use a single entitlement resolver extended with club grants.
4. Review ownership stays with the reviewer; club replies and reports only. Moderation is group-scoped and audit logged.
5. Keep legacy routes compatible while adding HQ tools incrementally.
6. Block merge and feature announcement until all required CI and fresh-origin both-theme proof passes.
