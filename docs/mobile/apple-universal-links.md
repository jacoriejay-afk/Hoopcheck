# Apple universal-link association

The app owner supplied `Y778LM35G5` and the complete App ID
`Y778LM35G5.online.hoopcheck.app` on 2026-11-18 in response to the signing-prefix
verification request. The candidate now uses that explicit public App ID. It does
not infer a prefix from the numeric App Store Connect ID or Expo project UUID.
This is owner-supplied identity evidence; independent comparison with a signed
archive remains pending because the existing IPA download returns HTTP 403.

The public dynamic `/.well-known/apple-app-site-association` route returns the
confirmed App ID by default, without requiring a production environment change.
An optional `HOOPCHECK_IOS_APP_IDENTIFIER_PREFIX` override must exactly match
`Y778LM35G5`; another prefix, malformed value or explicit empty value fails closed
with a non-cacheable 503. The 200 JSON response is cookie-free and caches for one
hour. The App ID is public association metadata, not a signing credential.

The allowlist includes the reconciled native homepage, teams/leagues/players,
search, feed/Reels, Live Games, club-group directory/group and profile editor.
Browser OAuth/recovery/referral capture, owner/admin web routes and unsupported
nested routes stay in the browser. Nested group paths are excluded before the
group wildcard. Women’s league profiles precede broader nested-path exclusions.
No universal-link path grants membership or bypasses authentication.

## Verification and release gates

- Actual helper/handler tests cover exact owner-confirmed identity, default and
  matching override, rejection of another valid-looking prefix, JSON/cache/status
  behavior, and allow/exclude ordering for integrated routes.
- Native URL contracts retain exact entity/post/game/search identity and safe
  fallback routing. Canonical root reaches the native entry point.
- CI tests the handler and native links. Local Next production build and HTTP
  checks verify the actual endpoint without a synthetic signing prefix.
- No signing credential, entitlement, bundle ID, remote build counter, production
  environment, EAS build, TestFlight submission or OTA changes in this work.

The production domain previously returned HTML 404 and is unchanged until an
explicitly approved merge/deployment. Before release, verify its exact 200 JSON
response without redirect/authentication and compare the App ID against signed
entitlements. On a physical iPhone, test external taps for homepage, team/league/
player/search/feed/Live Games/groups/profile edit and all browser-only exclusions.
Apple CDN propagation/caching and Safari same-domain behavior need device checks.
The owner-supplied App ID alone does not establish signing or link delivery.
