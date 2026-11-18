# Apple universal-link association

The production `/.well-known/apple-app-site-association` endpoint returned HTML
404 during read-only launch verification on 2026-11-18. The app already declares
`applinks:hoopcheck.online`, but that declaration alone cannot establish the website
association. Custom `hoopcheck:` routing does not prove universal-link delivery.

The new public, dynamic JSON route requires the server environment variable
`HOOPCHECK_IOS_APP_IDENTIFIER_PREFIX`. Its value must be the ten-character
ApplicationIdentifierPrefix from the signed iOS app/provisioning metadata, without
a trailing dot. Do not substitute the numeric App Store Connect ID, Expo project
UUID, an example value, or an unverified Apple team ID. The app identifier is then
`<verified-prefix>.online.hoopcheck.app`.

No prefix is currently verified or configured by this work. Missing/malformed
configuration returns a non-cacheable 503. This branch remains draft until the
real prefix is verified and the preview/production response and iPhone behavior
are checked. The unit-test prefix is synthetic and must never be deployed.

The association lists implemented native destinations rather than every website
page. Browser OAuth/recovery/referral routes and unsupported nested pages are
excluded so their browser session/cookie flow remains intact. Women’s league
profiles are included before the broader nested-path exclusions. Draft Live Games,
groups and profile-editor routes are not enabled by this main-based association;
add them only alongside verified route integration. Native root URLs now reach
the native entry screen instead of an unnecessary website handoff.

## Verification

- Actual handler/helper tests cover valid/missing/malformed configuration, exact
  bundle ID, response status/content type/cache control and allow/exclude order.
- Native URL regressions cover HTTPS root, empty custom-scheme links and discarding
  unexpected root query fields. Existing route/auth/privacy contracts also pass.
- Required CI includes the association tests; native checks retain their own suite.
- No new native module, entitlement, signing change, production environment value,
  EAS build or OTA is introduced. This code alone does not fix production links.

After obtaining the verified prefix, configure the intended server environment,
check a 200 JSON response on the exact deployment and canonical domain without
redirect/authentication, compare appIDs against signed entitlements, and test an
external tap on a physical iPhone with a local candidate installation. Include
homepage, team/league/player/search/feed links and the browser-only exclusions.
Apple CDN propagation/caching and Safari’s same-domain behavior require device
verification. Do not use a native build or OTA merely to discover the prefix.
