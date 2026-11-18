# Optional two-factor authentication — Build 8 candidate

Native and website account security pages support TOTP enrollment, verification,
named backup authenticators, cancellation of incomplete setup and fresh-code
removal. Removing the last verified factor requires explicit confirmation. A
registered backup can remove a lost primary. Unsupported remaining factor types
cannot strand a user by removing their last supported TOTP here. Password reset
does not bypass MFA; Supabase project users do not receive invented recovery codes.
Codes, QR images and setup secrets remain in memory and clear on background or
unmount. Cancellation never removes a verified factor. Account changes reset UI.

The native challenge reuses AppLock's single presentation before Face ID and
onboarding. The router remains mounted. Account/bootstrap requests wait for verified
security state. Unknown restoration and offline cold starts fail closed with retry
and normal-sign-in recovery. Previously server-verified in-memory identities can
retain their ready state during a connection loss; protected data still needs its
normal online entitlement check. Background timers and stale Face ID invalidation
are preserved.

Both clients verify the captured access token with Auth.getUser before inspecting
its subject, expiry and assurance. Verified Auth factors, never user_metadata,
determine whether aal2 is required. MFA writes execute through the auth action queue
and recheck their captured owner inside it. A queued sign-in for another account
cannot enroll or remove that new account's factors from an obsolete screen.

Server enforcement denies opted-in aal1 bearer/cookie API requests, redirects
protected SSR pages before private queries and handles OAuth challenges before
profile lookup. Owner/Ambassador helpers verify MFA before privileged reads. This
adds no membership, owner, moderation or paid entitlement; existing checks remain.
Public webhooks retain their signature/secret validation.

## Database rollout gate — not applied

`20261118162456_opted_in_mfa_enforcement.sql` was named with Supabase CLI 3.2.0.
It adds restrictive policies to existing RLS-enabled public tables, storage.objects
and realtime.messages, plus a PostgREST pre-request guard for security-definer RPCs.
The private definer helper reads only the caller's factor existence from Auth.
There are no public factor records or permissive access grants. An unexpected
existing pre-request hook aborts before mutations. Future RLS tables need the same
restrictive policy explicitly; future exposed schemas need equivalent coverage.
Deploy this migration transactionally and validate hook activation/reload in an
isolated Supabase environment before approved production rollout. It has NOT been
applied to either hosted project in this pass. UI/server checks do not substitute
for deploying and verifying direct Data API/Storage/Realtime enforcement.

## Evidence and remaining gates

- Seven core policy/action cases; eleven auth ordering/storage cases, including
  actual installed-SDK MFA/sign-in, sign-out/sign-in and queued cross-account MFA.
- Sixteen real-renderer lock/lifecycle cases, including MFA sharing one Modal.
  Twenty native test files pass; existing native auth integration passes.
- Nine server/proxy cases cover bearer/cookie MFA, SSR redirect, pending signup,
  invalid proof, public webhooks and owner role preservation.
- Isolated PostgreSQL engine tests pass row ownership, read/write denial, Storage,
  Realtime, pre-request RPC guard, opted-out and service/anon behavior. Negative
  controls fail without enforcement and reject an existing unrelated hook. Local
  Docker VFS exhausted disk, so local SQL used temporary PGlite 0.3.14. CI runs the
  fixture and negative controls against its real disposable PostgreSQL 16 service.
- Native browser fixtures pass both themes: cold challenge, incorrect code, backup
  recovery, enrollment, fresh-code removal, last-factor confirmation, background
  secret clearing and cancellation. Website production-mode browser fixtures pass
  SSR redirect, challenge, backup, enrollment and removal in both themes. All Auth,
  payment and database data is synthetic and isolated.
- Local website production build, iOS Hermes export, TypeScript, lint, surface/theme
  audits and the existing entitlement matrix pass. Exact PR CI results belong to
  its committed head, not this working-tree statement.

Before release: verify actual project TOTP configuration and hosted enforcement in
an isolated environment, plus password/Google/refresh/recovery with test accounts.
On a physical iPhone verify cold launch, rapid taps, Face ID cancel/failure/retry,
account changes, five-minute background lock, MFA background recovery and QR/code
entry. None of these physical checks is claimed to have passed. Issue #699 remains
open until device evidence confirms the freeze repair. StoreKit and protected
30-day account deletion are separate unfinished launch gates.
