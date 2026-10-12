# HoopCheck Native App Architecture Decision

Status: proposal only. No runtime code changes or store submissions.

## Current architecture confirmed from main

- Next.js 16 / React 19 / TypeScript.
- Supabase SSR authentication and database access.
- Next.js server/API routes for account deletion, reviews, moderation, and Stripe-related workflows.
- Stripe-based web subscriptions.
- Existing installable web manifest and SVG icon.
- Current production website remains the web source of truth.

## Important compatibility constraint

A static export of the current Next.js app is not an appropriate drop-in mobile build: the app relies on server-side rendering and API routes. Keep those hosted unless the architecture is deliberately redesigned.

## Options

### Option A: Capacitor shell with hosted web app

Advantages:
- Fastest route to an initial device prototype.
- Can reuse the current hosted app and backend.
- Can add selected native capabilities through plugins.

Risks:
- A thin wrapper around a website may fail Apple's minimum-functionality review.
- Need to test cookie/session persistence, external links, OAuth redirects, file upload, keyboard/safe areas, network loss, account deletion, and subscription flows.
- The existing web subscription checkout must be reviewed against the current rules for digital subscriptions on both stores.
- This approach does not itself provide offline support.

### Option B: React Native / Expo app using the existing backend

Advantages:
- Better control over native navigation and platform-specific UX.
- Easier to provide app-specific features rather than a thin website wrapper.
- Can retain Supabase as the backend while building native screens.

Trade-offs:
- More development and regression testing.
- The current Next.js UI cannot simply be reused unchanged.
- Subscription billing and entitlements need deliberate platform-specific implementation.

## Recommendation

Do not generate production store binaries until the owner chooses the packaging approach. For a fast feasibility test, build a separate, non-production prototype and evaluate a Capacitor shell first; if it cannot provide a clearly useful app experience, proceed with a native React Native/Expo UI. Keep the existing production site unchanged.

## Required release gates

1. Choose architecture and bundle identifiers/package ID.
2. Build and run on real iOS and Android devices.
3. Verify authentication, account recovery/deletion, support, reporting/moderation, privacy request flows, and subscription entitlements.
4. Decide and implement compliant subscription purchase/restore/cancel behavior for each store.
5. Generate final store icons and screenshots from real builds.
6. Complete privacy/data safety, age/content rating, support contact, reviewer access, and testing disclosures.
7. Upload only to TestFlight and Google Play internal/closed testing first.
8. Do not submit for public review or production rollout without explicit owner approval.

## Guardrails

- This is a design decision record, not an implementation.
- Do not change production code or deployment as part of this document.
- Do not perform real subscription payments.
- Do not submit to either store without explicit owner approval.
