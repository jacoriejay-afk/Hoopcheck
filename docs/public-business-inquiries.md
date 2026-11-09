# Public business inquiry rollout

This is a staged public form and server endpoint, not yet an active production feature. The CAPTCHA widget exists behind a disabled feature flag. Do not activate until the remaining security controls and end-to-end tests pass.

1. Review and apply `docs/sql/public-business-inquiries.sql` and `docs/sql/business-inquiry-rate-limit.sql` in order to the correct production Supabase project. The private RPC atomically limits each normalized email to three submissions per 24 hours.
2. Set server-only `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_ALLOWED_HOSTNAME=hoopcheck.online`, and `BUSINESS_INQUIRIES_ALLOWED_ORIGIN=https://hoopcheck.online`. Keep the service role key out of browser bundles and source control. The Origin check is defense-in-depth, not authentication or a replacement for rate limiting.
3. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and, **only after all checks pass**, `NEXT_PUBLIC_BUSINESS_INQUIRIES_ENABLED=true` and server-only `BUSINESS_INQUIRIES_API_ENABLED=true`. Both flags must be enabled for the public form to work. Leave them unset/false until release.
4. The database RPC provides durable per-email throttling; add an independent per-IP/edge rate limit to protect CAPTCHA verification and prevent rotating-address abuse. Also add privacy-safe operational monitoring, a defined retention/deletion schedule, and integration tests. The privacy-policy disclosure and link have been drafted, but require review before launch.
5. Verify success, invalid CAPTCHA, expired token, malformed input, and database errors in preview before production activation. Check that a signed-out visitor sees only the guest form, and a signed-in visitor sees only the existing account-based form. Confirm both dark and light themes on mobile.
6. Keep the existing signed-in flow until the replacement passes QA. The staged implementation shows the guest form only to signed-out visitors when enabled, and retains the signed-in form for authenticated users.

The endpoint intentionally fails closed when configuration is absent. The database table is private and must never receive anonymous INSERT grants.

## Release acceptance checklist

- [ ] CI and Final Gate succeed for the exact merge candidate SHA. (Both passed at `eb23b7f`; rerun on final SHA.)
- [ ] Database migrations run successfully in the intended environment; confirm no `anon` or `authenticated` access to the private table or RPC.
- [ ] Turnstile test keys and hostname validation work in preview; production secrets remain server-only.
- [ ] Edge-level IP throttling is configured and tested before the endpoint is enabled.
- [ ] Signed-out guest and signed-in member flows submit successfully without duplicate forms.
- [ ] Invalid, reused, and expired CAPTCHA tokens; malformed JSON; oversized bodies; honeypot entries; and rate-limit exhaustion fail safely.
- [ ] Privacy notice, retention schedule, monitoring, and mobile light/dark accessibility are reviewed.
- [ ] Both feature flags are enabled only after all preceding checks pass.

## Privacy and operations

- Add a visible privacy-policy link and explain that inquiry contact details are retained for business follow-up; establish a documented deletion schedule before launch.
- Do not log inquiry bodies, email addresses, CAPTCHA tokens, or service-role credentials.
- Configure an edge-enforced per-IP rate limit before Turnstile verification to prevent excessive verification traffic. Client-provided IP headers must not be trusted as authoritative.
- Verify database role grants and the `submit_business_inquiry` function privileges after applying the migrations.
- Review the existing signed-in form separately: it stores messages in `sponsor_inquiries`, not the new private guest table.

## Verified rollout notes (2026-11-09)

- Production Vercel contains the Turnstile site/secret keys, allowed hostname and allowed origin; values were not exposed. This verifies presence only, not successful Turnstile verification.
- Production Supabase migrations `create_private_business_inquiries` and `create_business_inquiry_rpc` succeeded. Read-only privilege checks confirmed RLS enabled, no anon SELECT, no authenticated INSERT, no anon/authenticated RPC EXECUTE, and service-role RPC EXECUTE allowed.
- A transaction-scoped four-submission test returned false on the fourth call; rollback completed and a follow-up query found zero test rows.
- Vercel firewall GET and PATCH both returned 404 `Seawall Config not found`. No edge rate-limit rule was installed. Do not enable the public endpoint until a verified per-IP rule or equivalent protection is installed and tested.
- CI and Final Gate passed at `eb23b7f`; newer changes require their own verification.
