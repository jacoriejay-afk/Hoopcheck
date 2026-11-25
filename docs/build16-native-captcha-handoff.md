# Native CAPTCHA handoff — Build 16

The HTTPS challenge route and Expo SDK 54 native modal are implemented, disabled by default. Login, signup and password recovery request an in-memory CAPTCHA response before calling Supabase Auth when EXPO_PUBLIC_AUTH_CAPTCHA_ENABLED=true. Disabled builds preserve the previous auth arguments; Google OAuth and the recovery redirect remain unchanged.

- Hosted route https://hoopcheck.online/auth/native-captcha requires HOOPCHECK_NATIVE_CAPTCHA_ENABLED=true and NEXT_PUBLIC_AUTH_TURNSTILE_SITE_KEY; otherwise returns HTTP 503. Separate from Supabase project-wide enforcement.
- Minimal HTML, no session or personal fields, no raw token in URLs, no storage/logging. Pinned challenge origin and nonce CSP. Native message parser accepts exact HTTPS URL and bounded versioned envelope. Modal is attempt-scoped; cancellation, errors, expiry, unmount and deadline reject; only the first valid response resolves. Supabase still validates provider tokens.
- Expo SDK 54 dependency resolved by actual Expo installer on GitHub Actions run 45589839484; Expo dependency check passed. Installed version 13.15.0, exact generated package manifest/lockfile blob prefixes d2a6cd4/a25a173. Temporary read-only dependency-resolution workflow removed after copying its exact generated diff.
- Four route/bridge regression tests wired into web production build and additional native mocked auth token forwarding/cancellation tests committed. Full revised-head CI pending.
- Real provider/device acceptance remains mandatory: test allowed frame navigation, cookies/storage, challenge success/failure/cancel/expiry, native login/signup/reset, Google OAuth and installed-client compatibility on iOS/Android. Provider keys and flags are not configured by this PR. Keep production Supabase CAPTCHA off until all supported clients comply.
- No additional paid infrastructure, native build or App Store submission.

Reference: https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/ and https://supabase.com/docs/guides/auth/auth-captcha .
