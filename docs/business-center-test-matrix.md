# Business Center release verification matrix

PR #365 is a draft. None of the checks below should be marked passed without test evidence.

| Scenario | Expected result |
| --- | --- |
| Signed-out visitor opens /business, /sponsors, /investors, /ambassadors | Public information loads without login redirect |
| Signed-out visitor opens /partners | Form explains login requirement and preserves entered draft during local navigation |
| Authenticated player/fan submits consented valid inquiry | Exactly one sponsor_inquiries row created with own user_id |
| Authenticated submit without consent | No insert; actionable validation message |
| Short message or stored message exceeding 3000 characters | No insert |
| Investor/ambassador/strategic inquiry | Stored as type=inquire with category prefix |
| Anonymous or ordinary authenticated user selects sponsor_inquiries | Zero rows visible (RLS) |
| Moderator opens /admin/business | Access denied; no inquiry rows returned |
| Administrator opens /admin/business before SELECT policy deployment | Graceful error, no data |
| Administrator opens /admin/business after reviewed policy deployment | Most recent 100 records visible, no edit controls |
| Admin switches to a non-admin account | Admin navigation disappears and access is denied |
| Repeated automated submissions | Server/database anti-abuse control blocks or throttles them (NOT IMPLEMENTED) |
| CI and launch tests on final SHA | Must pass before merge |
| Production smoke tests | Verify navigation, dark/light contrast, mobile layout, login, inquiry submit and access denial |

## Security gates
- Review and apply docs/business-admin-inbox-policy.sql in the correct environment; test admin and non-admin identities.
- Add server-side rate limiting or database-backed abuse prevention before exposing the form at scale.
- Do not expose service-role secrets or return all business inquiries to regular members.
- Keep sponsor/donate/inquire legacy values backward compatible.
- Confirm business inquiry retention and contact-consent language with the Privacy Policy.
- Verify no live payment, referral tracking or securities offering is implied by informational pages.

## Deployment evidence
Record final commit SHA, workflow run URLs, migration identifier (if any), production deployment URL and dated smoke-test results here before closing the PR.
