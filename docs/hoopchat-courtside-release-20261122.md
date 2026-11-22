# HoopChat Courtside — messaging UI and safety contract

Released surface: `/messages` (with an embedded compatible instance in `/notifications?tab=messages`).

## Experience
- Fast searchable private thread rail with sender names, last-message previews, request status, unread-on-this-device counts, and Pinned / Unread / Requests filters.
- New HoopCheck "PLAYBOOK" chips insert suggested basketball openers (introductions, film, opportunities and game talk) **into the draft only**, never send a message autonomously.
- Compact vs comfortable layout, Courtside vs classic message style, accessible text-size control, and orange/blue/purple accents.
- Thread pin, local mute and read position stored on this device under a user-specific key. **No message text or drafts are written to browser localStorage**. A local mute only filters this inbox's badges; it is not a server-side block or push setting.
- Native Supabase Realtime INSERT subscription for the selected authorized conversation with foreground catch-up polling every 25 seconds. All updates are re-read through the member's RLS-protected Supabase client; no service-role credentials are delivered to the browser.
- Deep links to authorized threads via `?thread=...` (link never bypasses participant RLS), session-change cancellation and strict signed-in checks before writes.
- Consent remains enforced: messages can be exchanged only on *accepted* `player_contact_requests` between eligible parties. Incoming player contact requests may be accepted or declined by the intended player. No new permission granted to fans, suspended users or unconnected accounts.
- Uses existing player contact requests/messages tables and applies **no schema migration**, so the feature is an additive UI/UX release. The existing `PlayerContactButton` retains its gated request initiation controls. HoopGroups, Live Games and Team Fan Groups remain distinct.

## Verification and release gates
- Run exact-head Next.js TypeScript/build/lint, source contract suite, account-isolation and entitlement workflows, English/Spanish theme/browser sweeps, and verify production SHA on Vercel.
- Physical iPhone keyboard and accessibility checks remain owner acceptance tasks. Do not claim these from browser CI.
- Production messaging already depends on deployed `player_contact_requests` / `player_contact_messages` RLS. No production DDL or membership changes are part of this release.
- Optional future service-backed unread receipts, true universal-member DMs, member blocking/reporting for private messages, attachments, voice chat and message encryption at rest require separate backend policies and product sign-off. Do not misrepresent local markers as cross-device receipts or a live typing indicator.

## Rollback
Revert the website merge or roll back Vercel to the prior READY deployment. No database rollback is needed. Existing private HoopChat content stays intact.
