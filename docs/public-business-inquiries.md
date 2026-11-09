# Public business inquiry rollout

This is a staged server endpoint, not yet an active public form. Do not merge as a completed feature until a frontend CAPTCHA widget and integration tests are added.

1. Review and apply `docs/sql/public-business-inquiries.sql` and `docs/sql/business-inquiry-rate-limit.sql` in order to the correct production Supabase project. The private RPC atomically limits each normalized email to three submissions per 24 hours.
2. Set server-only `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, and `TURNSTILE_ALLOWED_HOSTNAME=hoopcheck.online`. Keep the service role key out of browser bundles and source control.
3. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and, **only after all checks pass**, `NEXT_PUBLIC_BUSINESS_INQUIRIES_ENABLED=true` and server-only `BUSINESS_INQUIRIES_API_ENABLED=true`. Both flags must be enabled for the public form to work. Leave them unset/false until release.
4. The database RPC provides durable per-email throttling; add an independent per-IP/edge rate limit to protect CAPTCHA verification and prevent rotating-address abuse. Also add logging/alerting, privacy notice, retention policy and integration tests.
5. Verify success, invalid CAPTCHA, expired token, malformed input, and database errors in preview before production activation.
6. Keep the existing signed-in flow until the replacement passes QA.

The endpoint intentionally fails closed when configuration is absent. The database table is private and must never receive anonymous INSERT grants.
