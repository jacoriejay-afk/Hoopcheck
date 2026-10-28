# HoopCheck native staging runbook

Status: **blocked until a dedicated staging environment exists**. This runbook is a checklist, not evidence that staging has been provisioned.

## Non-negotiable isolation rules

- Do not point a native build at `https://hoopcheck.online` or any subdomain.
- Do not use a Vercel Preview deployment as staging merely because it returns HTTP 200.
- Do not run account creation, password reset, uploads, moderation mutations, checkout, or subscription tests until the deployed app's effective Supabase project and Stripe mode are independently verified.
- Never print, paste into logs, or commit environment-variable values, access tokens, service-role keys, Stripe secrets, or signing credentials.
- Keep production Supabase, Stripe live mode, production environment variables, and production deployment unchanged.
- Do not apply the Apple IAP or native device-token migrations to production.

## Provisioning checklist

### 1. Select an isolated hostname

Choose a dedicated HTTPS hostname **outside** `hoopcheck.online`, for example a company-controlled staging domain. Confirm DNS and TLS are valid. Do not use the example below as a real configured hostname.

### 2. Create or designate isolated Supabase

- Create a separate Supabase project for staging, or formally designate an existing non-production project.
- Apply only reviewed staging migrations to that staging project.
- Seed synthetic test users and synthetic basketball/team data; do not copy production personal data.
- Configure staging Auth redirect URLs and allowed callback URLs explicitly.
- Verify the deployed staging runtime references the staging project using non-secret project identifiers and read-only checks.
- Confirm that production project identifiers and service-role credentials are not available to the staging runtime.

### 3. Configure Vercel without sharing production targets

- Use a dedicated Vercel project or a custom environment with explicitly isolated variables.
- Configure the staging Supabase URL and public anon key for the staging runtime.
- Configure Stripe test-mode secrets and test price IDs only; do not reuse Production-targeted values.
- Ensure all payment-mode guards fail closed when test configuration is absent or inconsistent.
- Verify variable target/scope metadata before deploying. Do not decrypt or echo secret values to prove the setup.
- Record the deployment URL, commit SHA, Supabase project reference, and Stripe mode in the staging change record. Never record credentials.

### 4. Validate deployed isolation before user journeys

Read-only checks first:
- staging hostname serves HTTPS and the expected commit;
- expected staging Supabase project reference is in effect;
- auth callback allowlists point only to intended staging URLs;
- checkout configuration is explicitly test mode and uses test price IDs;
- no live Stripe secret or production Supabase service-role key is present in the staging runtime.

Only after all checks are evidenced should test accounts, uploads, or Stripe test checkout be exercised.

### 5. Configure Capacitor locally

Set `CAPACITOR_SERVER_URL` to the verified staging **origin only** (scheme + hostname + optional port; no path, query, or fragment). Never commit it to a shared config file.

Run:

```sh
npm run test:capacitor-origin
npm run test:native-links
```

Then run the project's type/lint/build checks available in the developer environment. A successful unit test does not establish native runtime behavior.

### 6. Device smoke-test record

For each iOS and Android device/OS, record:
- app build SHA and staging hostname;
- sign-in, refresh, background/foreground, sign-out and protected-back-navigation results;
- password reset and any enabled OAuth callback behavior;
- valid/invalid deep-link results;
- feed image/video upload, cancellation, and moderation results;
- offline/reconnect and external-link behavior;
- Stripe **test** checkout and cancel/return path, without a live charge.

Do not call staging or the native prototype production-ready until the acceptance matrix is completed with evidence.

## Current verified blockers

- Vercel project custom-environment listing returned no custom environments.
- The recent Vercel deployment checks are failing due to the team's build-rate-limit response; source changes therefore do not have a passing CI verification in the current run.
- No staging Supabase project, isolated Stripe test configuration, signed native build, or device test is confirmed by this runbook.
- No production resources or settings are changed by this document.
