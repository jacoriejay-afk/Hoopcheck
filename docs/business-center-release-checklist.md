# Business Partnerships Center — release checklist

## Implemented in draft PR #365
- /business, /sponsors, /investors and /ambassadors information pages
- /partners expanded authenticated inquiry form using EXISTING public.sponsor_inquiries
- /admin/business read-only administrator inbox (not deployed)
- Admin-only navigation to business inbox
- Consent checkbox and Privacy Policy link
- Per-account database rate limiter installed in production; functional account testing pending

## Production database state — 2026-11-09
- Existing sponsor_inquiries table retained; no duplicate table created.
- Existing authenticated INSERT RLS policy remains.
- **Applied migration:** business_inquiries_admin_read_policy.
- Verified policy: SELECT for authenticated users only when
  public.get_current_user_admin_role() = 'admin'.
- Schema and policy inspection succeeded; live session-based authorization tests remain pending.
- **Applied migration:** business_inquiry_submission_throttle. Verified trigger sponsor_inquiries_submission_limit is installed. Functional authenticated and concurrent-submission tests remain pending. Existing form remains directly client-to-Supabase.

## Release blockers
1. Test the SELECT policy using genuine admin, moderator and regular member sessions.
2. Test installed database-enforced rate limiting with authenticated users; check parallel inserts and rolling windows.
3. Validate signed-in inquiry submission, consent, error states and category persistence.
4. Check accessibility, mobile layouts and dark/light themes.
5. Wait for final SHA CI and launch tests to pass.
6. Merge only after checks pass; smoke-test production routes and account access.
7. Plan notification workflow, retention/deletion rules, and sponsor invoicing separately.

## Safety
- Sponsorships cannot change reviews or trust scores.
- Investor page is informational, not an offer to sell securities.
- No sponsor payments or ambassador commissions are collected by these pages.
- Never place service-role keys in browser code.
