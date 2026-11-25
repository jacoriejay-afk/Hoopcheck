# Build 16 CAPTCHA rollout gate

Web login, email signup, password recovery, and confirmation resend now accept a one-use Cloudflare Turnstile response in the Supabase Auth options. The separate public build-time setting NEXT_PUBLIC_AUTH_TURNSTILE_SITE_KEY is intentionally unset by default; existing web and installed app authentication continues unchanged. Never reuse the business-inquiry site key or place the secret in NEXT_PUBLIC_*.

Before enabling:
1. Configure a free Turnstile widget for the exact approved web origins and test environment. Store the secret in Supabase Auth CAPTCHA configuration only, not GitHub or chat.
2. Verify all native and installed-client password sign-in, signup, resend and reset flows can obtain and pass valid CAPTCHA tokens; web-only integration is insufficient. Keep OAuth completion unchanged, and test Google sign-in and redirect flows.
3. Deploy and test with the public site key in isolated Preview and existing test Auth project, including missing, expired, reused and invalid token, valid login/signup/recovery/resend, failed script, retry, accessibility, and same-origin/callback regressions.
4. Only after acceptance enable project-wide server-side CAPTCHA with the matching provider and secret. Do not enable on production while an installed client cannot comply; perform a rollback exercise with the existing configuration.
5. Confirm direct Auth API requests without a valid token are rejected. A UI widget alone is not anti-bot enforcement.

No site key or secret configured, no project-wide CAPTCHA activated, no new dependency, no paid services, no Expo build or app submission. CI and real provider/native acceptance remain pending.
