# Business Partnerships Center — release checklist

## Implemented in draft PR #365
- /business overview with links to category pages
- /sponsors proposed pilot packages
- /investors informational page with no securities offer
- /ambassadors collaboration overview
- proposed private database schema in docs/business-inquiries-schema.sql

## Blockers before production
1. Review existing navigation, accessibility, responsive layout and theme contrast.
2. Add secure POST endpoint with schema validation, bot protection and per-IP rate limiting. Never expose service-role credentials to browsers.
3. Apply reviewed schema to a safe environment, confirm RLS prevents anonymous SELECT and INSERT, and verify privileged server insertion.
4. Add consent checkbox, privacy notice and retention/deletion policy.
5. Add admin-only inbox using existing verified authorization model; never use user-editable metadata for role checks.
6. Add notification delivery and test failures/retries.
7. Confirm Stripe invoicing workflow only after sponsor contracts and deliverables are approved.
8. Verify actual audience metrics before publishing sponsor media kit; obtain legal review before any investment offering.
9. Run lint/build/tests, check route access and mobile layout, resolve conflicts, merge and verify deployment.

## Safety and commercial rules
- Sponsorships do not affect reviews or trust ratings.
- Public investor page is not an offering or solicitation.
- Do not claim an inquiry form is live before backend and abuse protection are verified.
- No guaranteed returns, ownership, or commission without a signed agreement.
