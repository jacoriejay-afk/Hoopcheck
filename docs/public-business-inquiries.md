# Public business inquiry rollout

This is a staged server endpoint, not yet an active public form. Do not merge as a completed feature until a frontend CAPTCHA widget and integration tests are added.

1. Review and apply `docs/sql/public-business-inquiries.sql` to the correct production Supabase project.
2. Set server-only `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, and `TURNSTILE_ALLOWED_HOSTNAME=hoopcheck.online`. Keep the service role key out of browser bundles and source control.
3. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and, **only after all checks pass**, `NEXT_PUBLIC_BUSINESS_INQUIRIES_ENABLED=true`. The guest form is wired to `/partners` behind this flag. Leave it unset/false until release.
4. Add a durable distributed rate limit (not in-memory), logging/alerting, privacy notice, retention policy and integration tests. CAPTCHA alone is not sufficient abuse protection.
5. Verify success, invalid CAPTCHA, expired token, malformed input, and database errors in preview before production activation.
6. Keep the existing signed-in flow until the replacement passes QA.

The endpoint intentionally fails closed when configuration is absent. The database table is private and must never receive anonymous INSERT grants.
