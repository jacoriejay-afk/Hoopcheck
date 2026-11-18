# Authentication transition ordering

The installed Supabase SDK serializes MFA verification but password sign-in can
save a session while a previous verification HTTP request is still pending. An
executable test with the real SDK starts verification for account A, signs in B,
then delivers A's delayed verification response. Guarding the Auth response keeps
B's session; an obsolete verification cannot write its elevated session.

The shared guard covers token, signup, OTP, logout, user-update and MFA-verification responses. Each
explicit sign-in/signup/code exchange/session replacement/sign-out begins a new
intent. Successful older responses return an error before the SDK persists them.
MFA responses must also match the request token's subject. This subject comparison
is denial-only; it is not signature verification or authorization. Normal Auth
verification and all existing server permissions remain authoritative.

Website tabs share a non-secret first-party session cookie containing only an
intent nonce. Tampering can cause denial, never grant access or choose an account.
Native uses an in-process nonce. Auth HTTP requests, including body consumption,
have a 20-second abort deadline; non-Auth requests retain their normal behavior.
No credential-storage write is timed out or abandoned.

Native SecureStore mutations serialize per key. A pending old write completes
before logout/removal and the following sign-in write. Reads wait for pending
mutations and retain the existing bounded-read recovery. A failed mutation does
not poison the queue. The website continues using Supabase's existing SSR cookie
storage; no token is moved into a new storage system.

Ten regressions cover stale password/refresh/MFA responses, owner mismatch,
shared-tab intent changes, method binding, ordered native set/remove/set and
failed-write recovery, including real-SDK concurrent MFA/sign-in and sign-out/sign-in cases. The small
platform-neutral policy lives in lib/auth and is shared by web and native; Metro
watches only that shared directory without replacing normal module resolution.

This change does not implement MFA challenge/enrollment UI, authorize aal2 by
itself, prove physical Keychain behavior or resolve Issue #699's device freeze.
Those are separate gates. No EAS build, TestFlight submission, OTA, signing change,
production database/Stripe mutation or merge is performed.

Public session-changing operations also serialize per client. Supporting browsers use a separate Web Lock across tabs, while the shared intent nonce rejects stale responses. Queued obsolete actions are skipped before invocation. MFA verification and user updates continue the captured account intent. Binding is idempotent to prevent nested queues during client reuse. This does not replace Supabase’s internal session lock or certify every OAuth callback race.
