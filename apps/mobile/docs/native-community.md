# Native community and website navigation

The native app adds `/feed`, the canonical `/fan-feed` redirect, `/reels`, and
`/notifications`. Bottom navigation follows the mobile website: Home, HoopFeed
(FAN HQ for a verified fan account), Search, Alerts, Account. Directories remain
available from Home and Search, with navigation visible on their detail pages.

The account provider obtains fresh, bearer-verified canonical entitlements from
`/api/mobile/bootstrap`; offline, failed, stale, or mismatched-identity responses
grant no feed access. Feature permissions and private content are not persisted.

Feed reads use the authenticated Supabase client and existing RLS, approved and
unexpired posts, viewer-scoped archives, bounded keyset pagination, and limited
public author fields. Comments/replies, posts, votes and bookmarks reuse the
website's moderation endpoint and server authorization. Checks use the existing
caller-scoped RLS mutation and aggregate RPC. Unknown counts/bookmark status are
disabled rather than presented as successful state. Failed moderation preserves
drafts; drafts/comments/media are bound to the current account identity.

Photos and videos obtain short-lived authorization through the existing media
endpoint. Only signed URLs under the configured Supabase project's signed-object
path are accepted. Visible, focused cells load media; navigation/backgrounding
pauses playback, and signed URLs renew without persisting tokens. Expo Video
`~3.0.16` is SDK 54 compatible. This native module requires a new binary, which
has not been requested or started. Browser playback does not prove AVPlayer on an
iPhone.

Alerts use the real `read_at` schema, explicit viewer filters and existing RLS.
Marking read applies only server-returned IDs to local state. Auth changes clear
old rows and reload outside the Supabase auth callback to avoid its session lock.

## Evidence

- Mobile TypeScript, native client contracts, auth integration and changed-file
  ESLint pass. New real-Supabase-client/fetch fixtures cover query scope, cursor
  validation, expiry, archive/bookmark isolation, signed media, moderated reply
  projection, check mutation/RPC, and alert reads/writes.
- Isolated 390×844 React Native Web tests pass in light and dark: rejected and
  accepted posting, draft retention, reply publication, checks, bookmarks, polls,
  synthetic WebM playback, alerts, account and all five tabs. A denied membership
  starts no protected feed query. Directory/search/league tests also pass.
- SDK dependency check, Expo Doctor 18/18, local iOS Hermes export, and clean
  isolated iOS prebuild pass. Prebuild does not compile/sign an archive.
- CI now runs local iOS/web exports and browser fixtures using a committed 1.8 kB
  synthetic video and pinned development-only Playwright. All external requests
  are intercepted; no production/test-project records or payments are touched.

Run the fixture with the three public environment variables set to
`https://fixture.supabase.co`, `fixture-publishable-key`, and `https://api.test`:

```sh
npx --no-install expo export --platform web --clear --output-dir /tmp/hoopcheck-mobile-web
python3 scripts/serve-native-fixture.py /tmp/hoopcheck-mobile-web 8092
# Separate terminal, in apps/mobile:
node scripts/verify-feed-browser.cjs
NATIVE_TEST_URL=http://127.0.0.1:8092 node scripts/verify-discovery-browser.cjs
```

## Remaining verification and scope

This is not full website parity. Native media upload/poll creation, edit/delete,
report/block controls, profile customization, live chat, groups and store billing
are separate work. Existing website destinations remain available where native
screens have not been implemented. This work does not establish the root cause or
physical repair of Build 7's freeze (#699/#700).

Before release: physical iPhone touch/scroll/keyboard checks, AVPlayer/short-lived
URL renewal, lock/onboarding, signed-in identity transitions, shared-post links,
small-screen safe areas, VoiceOver and offline/reconnect tests. No EAS build,
OTA, signing changes or production data writes were performed.
