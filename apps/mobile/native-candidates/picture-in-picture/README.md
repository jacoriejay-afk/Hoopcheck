# Official guide video PiP candidate

Uses the installed expo-video native player with explicit user PiP actions and best-effort shutdown on unmount. The compile-time asset allowlist is empty because the repository has no approved original public instructional video. Arbitrary URIs, private feed/reel content, subscription-gated video and provider streams are not eligible. All new paths are default-off; no app route, background audio mode, Android PiP manifest capability or entitlements are added.

Before activation: owner approves and provides rights-cleared bundled assets, adds exact static asset references and rights evidence, wires a session-scoped authenticated/unlocked host that unmounts on sign-out, account switching, opt-out and navigation, enables only the approved native config, and verifies stop/restart, lifecycle, accessibility and app-switch behavior on physical iOS and Android. Private or revocable streams are out of scope until a separately reviewed native authorization/expiry/revocation design is verified. No new Expo build or public release is authorized by this candidate.

Expo-video docs: https://docs.expo.dev/versions/v54.0.0/sdk/video/
