# Step 5 — controlled launch and first 1,000 active users

Status: preparation only; public rollout HOLD. Base QA commit f6d1c2cb540ffcd7dd660f57d001894880c89ad4. Step 5 is independent of the earlier Phase 5 Reels safety track. The owner is handling remaining database reconciliation; this branch does not change migrations or any live system. PR #1137 and Step 4 evidence remain authoritative for technical release gates.

## Launch sequence

| Stage | Suggested target | Entry condition | Exit condition |
|---|---|---|---|
| Internal | 10 synthetic/approved testers | Step 4 release evidence reviewed; signed test builds approved | Role flows and support escalation accepted; no unresolved P0/P1 |
| Closed beta | 25–50 invited people | Store test channels and privacy/deletion/billing validated | At least 7 days of observations, no P0/P1, reviewed user feedback |
| Controlled release | 100 weekly active users | Owner approves exact signed builds and compatible backend | 7 days of stable service; agreed metrics available |
| Expansion | 250, 500, 1,000 weekly active users | Prior cohort accepted | Owner reviews retention, cost, moderation and support before each increase |

Targets are proposed operating milestones, not forecasts or actual results. Never automatically advance a stage. Pause on security, privacy, billing, or data-loss issues, or a major feature outage; follow STEP4-OPERATIONS-RUNBOOK.md. Define incident owner and backup before invitations. Do not treat absent crash/analytics observations as success.

## Onboarding and role acceptance

For each exact signed build and web candidate use consented testers or synthetic accounts:
- Player: signup, email verification, choose role, complete profile, discover a team, review access and membership state; first review subject to existing moderation and eligibility rules.
- Fan: follow a team, read permitted content, join a community, cannot submit player reviews.
- Coach, Agent/Scout, Team Manager: verify legitimate role, directory and authorized workflows; no access to another role's private data or staff functions.
- Every role: recovery, reporting/blocking, account settings, deletion and export, accessibility, offline retry. Test Free/Pro/Premium and cross-account entitlement isolation where applicable. Do not advertise an unavailable feature, trial or benefit.
- Owner HQ and Ambassador HQ: verify server-authorized access, referral attribution, deduplication, commission ledger against signed agreements, no client-controlled entitlement. No automatic payouts or commission changes.

## Acquisition playbook

Use existing HoopCheck brand and original athlete imagery, with consent. No scraping contact lists or unsolicited mass messages. Budget: no paid campaigns until approved.
1. Founder-led overseas player outreach: 10 opt-in conversations per day; invite interested players to closed beta, ask for one concrete directory/review usability observation.
2. Ambassador/referral: provide approved creatives, individualized existing referral links and disclosed commercial relationships. Do not promise earnings or commission rates beyond signed terms.
3. Organic content: three weekly themes (know before you sign, basketball career identity, community), plus one honest availability announcement when the release is approved. No store badges or launch dates before availability is confirmed.
4. Team/league relationships: approach verified contacts for feedback and legitimate data corrections; do not imply official partnership or licensed coverage without evidence.
5. Weekly feedback: triage by severity; investigate repeat onboarding failures; publish accurate change notes after approval.

## Metrics and definitions

Use aggregate data only. Existing Owner HQ activation diagnostics are a bounded web research-page observation, not verified activation, native engagement, or signup conversion. Do not relabel them. Signup starts/confirmation and native activity need separately reviewed instrumentation. No user-identifying exports or raw browsing history.

| Metric | Definition | Source / gap |
|---|---|---|
| Weekly active users | Unique authenticated accounts with an accepted qualifying action within trailing 7 UTC days; exclude fixtures/staff as reviewed | Cross-platform event coverage not established; unavailable until verified |
| Signup conversion | Verified completed signups / unique eligible signup starts in same cohort | Instrumentation gap |
| D7 retention | Cohort accounts with qualifying action on UTC day 7 / eligible cohort with full observation | Instrumentation gap |
| First-week research | Profiles created in completed cohort with observed eligible web research visit | Existing Owner HQ activation diagnostics; small-cell suppression |
| Paid conversion | Verified active paid members / eligible activated accounts in same defined cohort | Billing reconciliation required; separate Stripe/StoreKit |
| Referral conversion | Deduplicated eligible referred signups / eligible referral visits | Verify existing attribution and denominator |
| Support | Open P0/P1, median first response, unresolved privacy requests | Approved support queue and evidence; unknown if not measured |

The 1,000 goal means weekly active users, not downloads, impressions or all-time signups. Provisional growth-stage thresholds for owner review: zero unresolved P0/P1; 100% completion of required release evidence; all privacy/report/block controls accessible; no unresolved unauthorized access or duplicate charging; reviewed support capacity and budget. Define numeric retention/crash targets after measured baseline, not invented percentages.

## Founding Member and campaigns

Existing eligibility uses confirmed Auth account creation time and owner-set UTC cutoff (lib/owner/founding-member.ts); feature stays disabled unless separately approved. Confirm exact cutoff and public badge wording; no paid access, verification, lifetime benefit, or ranking implied. Test cutoff edge, unconfirmed account, disabled flag, cross-account display and both platforms. Keep campaign attribution and diagnostics off pending data governance review. No free trial claims until real offer/eligibility and billing lifecycle accepted.

## Approval checklist

- [ ] Technical gates in #1137 and Step 4 are independently reviewed and completed.
- [ ] Exact web, iOS and Android builds matched to release evidence; store accounts/agreements verified.
- [ ] Store copy, screenshots, privacy disclosures, content rating, support URL and reviewer access verified on the actual builds.
- [ ] Legal launch checklist and retention/deletion rules approved by qualified reviewers.
- [ ] Owner designates support/moderation responders, incident owner, monitoring thresholds and rollback-compatible release.
- [ ] Beta invitations approved and consented, no real customer data in evidence.
- [ ] Owner authorizes rollout, launch messaging, and spending separately.
