# Startup and unlock recovery — Build 8 candidate

The root navigator now mounts on its first render, including when the display
font is pending or failed. Previously a restored auth session could redirect
before the Stack mounted; a stalled font read could also leave a blank screen
after the splash deadline. The existing splash deadline remains a fallback.

Session bootstrap has a bounded read and explicit retry. An unknown restoration
result is not treated as a confirmed sign-out. Auth notifications take precedence
over earlier reads, and callbacks remain synchronous to avoid Supabase auth-lock
reentrancy. Native credential reads have deadlines; credential writes retain
serialization and are never abandoned or raced against a timer.

Settings restoration fails closed with retry. A rejected or stalled read cannot
create a writer using guessed defaults or overwrite existing lock preferences.
The successful-write-only preference writer is unchanged.

AppLock still owns the only startup native Modal. Its priority is hydration and
recovery, then device lock, then onboarding. Unused presentations unmount. Unlock
state, background timestamps and fresh-password/OAuth sign-in exemptions are
bound to the actual session user ID. Account changes, background transitions and
expired Face ID attempts invalidate old completions. Failed or cancelled device
authentication keeps content concealed. A hung prompt recovers its controls;
normal sign-in still uses the existing local sign-out path. Only a real auth event
reveals the signed-out route.

## Automated evidence

- 15 real-component renderer cases exercise modal ownership, transitions, unlock
  failure/cancellation/timeout, account switches, background/foreground and retry.
- Five startup/settings cases exercise stale auth reads, synchronous notifications,
  disposal, deadline/retry, rejected storage reads and unchanged persisted settings.
- 14 auth screen/root integration cases include a navigator mounted while the font
  never loads; 19 URL/lock/privacy contracts include identity-bound fresh sign-in.
- Mobile TypeScript and all 15 native test files pass locally. Changed-file ESLint
  has zero errors; existing ref-cleanup warnings are reported, not suppressed.
- UIKit touch delivery, Face ID hardware, keyboard and actual iPhone background
  behavior are not exercised by these tests.

## Build 7 evidence limits

The authenticated Expo connector reports production Build 7 as FINISHED, version
0.2.0, SDK 54, build ID `346afb80-2759-4bd1-95ec-87a4698dee07`, source
`fe9691b7d619e92370ac498169f7b36d8b64d1c2`. That source commit is not available
from this GitHub repository (explicit fetch returns "not our ref"). Do not claim
that a comparison to current main establishes the exact shipped source.

The TestFlight crash query reports no submissions. Build-log access fails and the
existing IPA download returns HTTP 403; CLI authentication is separate from the
working connector and currently reports "Not logged in". No signed identifier,
provisioning expiry, Xcode/SDK archive metadata or new build counter is inferred.
No EAS build, TestFlight submission, OTA, signing change or production write was
performed. These source repairs do not establish the physical freeze cause.
Issue #699 must stay open pending the physical-device matrix in build-8-readiness.md.
