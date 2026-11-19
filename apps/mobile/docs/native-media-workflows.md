# Native media workflows

Photo/video uploads now use the existing HoopFeed membership and moderation
endpoints. No role, entitlement, moderation, schema or storage policy changes are
introduced. Media controls render only for the existing posting entitlement.

- Choose photos from the system library, crop with the system editor, rotate,
  preview and remove. Manipulation re-encodes JPEG without copied EXIF, with a
  1,440-pixel maximum edge (720 square for avatars) and a 750,000-byte limit.
  Up to four photos remain below 3 MB before multipart overhead, below Vercel's
  function request-body limit. Rejected requests retain caption and media.
- Videos use the existing server-issued private upload token and owned UUID path.
  Only MP4/MOV/WebM up to 50 MB is accepted. Library selection supports limited
  access and a Settings recovery action. SDK 54 native binary uploads use a
  file-backed foreground URLSession task with cancellation, avoiding base64 or
  JavaScript buffering of full videos. Web uses a local Blob.
- The existing moderation endpoint receives the private reference and caption;
  media is not marked published without an actual allowed response. Confirmed
  upload/rejection failures call the owned-path cleanup endpoint. An uncertain
  moderation response never deletes a potentially published object and blocks
  direct retry while offering feed review. It does not claim exactly-once
  publication; the existing server endpoint has no idempotency key.
- Profile-photo upload captures and verifies the session JWT, then uses it for
  both own-directory storage and the exact owner-filtered profile update. Only
  avatar_url is written; moderation, identity, role and verification fields remain
  untouched. Failed saves retain the selected image. A possibly committed profile
  write never triggers deletion of its possibly referenced avatar.
- New media and selected-photo state are component/session scoped, are not stored
  in AsyncStorage, and clear on unmount/account changes. Account changes invalidate
  old UI completions and cancel active feed uploads. OS-managed cache files may
  persist until the OS purges its cache; original library assets are never deleted.
- The image-only picker requests selected assets without blanket library access.
  The video flow requests library access before opening its editor. App config
  adds a photo-library purpose description and explicitly disables camera and
  microphone permissions. No camera recording feature is added.

## Evidence and remaining device gates

Seven network/client cases cover multipart posts, limits, captured ownership,
signed upload paths, cleanup, uncertain publication and avatar permissions.
Six SDK-bridge cases cover crop/resize/rotation, compression limits, permission
denial/limited access/cancellation, local file validation and cancellable native
binary uploads. Real browser file pickers, JPEG manipulation, rejected/successful
photo posts, private video upload and rejected/successful avatar saves pass in
light/dark with intercepted endpoints and synthetic files only. Existing browser
suites cover the rest of the native navigation and role matrix.

Expo Doctor passes 18/18 and local no-install iOS prebuild passes. Inspection of
actual Info.plist confirms photo and Face ID descriptions and absence of camera
and microphone descriptions. CFBundleVersion=1 in this generated project is the
local fallback, not evidence of the remote EAS counter; production versioning
remains remote and no build counter was changed. CI repeats prebuild inspection.

Local export/prebuild and web tests do not compile Swift or exercise UIKit,
PHPicker, Photos limited-access/iCloud downloads, MOV codecs/trim UI, device
storage pressure, URLSession cancellation, VoiceOver or real AVPlayer playback.
Those remain required physical iPhone checks before Build 8 can be released.
No build, TestFlight submission, OTA, live database/Stripe write or merge occurs.
