# Native CAPTCHA handoff — Build 16

This PR provides a disabled-by-default isolated HTTPS challenge route and a pure native bridge message validator, not a complete native authentication flow.

- Route: https://hoopcheck.online/auth/native-captcha. Requires HOOPCHECK_NATIVE_CAPTCHA_ENABLED=true and the existing NEXT_PUBLIC_AUTH_TURNSTILE_SITE_KEY; otherwise HTTP 503. Separate from Supabase project-wide enforcement.
- Minimal HTML, no application layout, no session or personal fields, no raw verification token in URL, no storage, no logging. Pinned challenge script/frame origin and nonce CSP. Raw token crosses only the native bridge; Supabase Auth is the authority that must validate and consume it.
- Native parser accepts only the exact canonical HTTPS route, bounded JSON, versioned message envelope, token/expired/error status. Caller must also ensure current mounted WebView and main-frame navigation state.
- Four regression tests are wired into the existing web production-build command; CI pending.
- Expo SDK 54 currently lacks react-native-webview. Registry access failed with EAI_AGAIN in the available local environment; do not hand-edit the lockfile or add a paid sandbox. Use Expo's SDK-aligned package installer in an authorized environment and commit the generated lockfile.
- Complete native WebView integration before activating: allow only exact challenge page top-level navigation, block new windows, do not inject untrusted scripts, reject stale/unmounted callbacks, consume token once in memory, close on cancel/expiry, pass captchaToken to password sign-in/signup/recovery. Do not pass credentials to the WebView or put tokens in URLs. Keep Google OAuth and recovery redirect unchanged. Test real Cloudflare widget with iOS/Android release candidates and installed-client compatibility. Supabase CAPTCHA must stay disabled until all supported clients can comply.

References: https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/ and https://supabase.com/docs/guides/auth/auth-captcha .
No provider credential change, paid infrastructure, new native build, deployment promotion or app submission.
