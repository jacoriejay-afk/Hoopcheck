# Owner brand bundle — November 24, 2026

Source: owner-uploaded alphabet (A–Z and 0–9, angular pointed terminals) and white open shield, basketball and orange upward arrow reference. Reuse the existing owner-traced wordmark and bundled HoopCheckDisplay fonts, rather than replace them with an approximation font. New symbol is a manual vector redraw of the reference; smoke/background is not part of the identity. Orange: #FF6A00. In-app ink follows theme. App icons use dark backgrounds.

This first integration covers shared web Logo, public SVGs, native welcome and dashboard header, and restrained loader motion. No new dependency, auth, data or entitlement change. Native launcher/splash and PWA PNG assets are updated with matching geometry. Motion respects reduced motion and does not delay navigation. Sub-brand logo variants and physical-device release validation remain separate review items.

QA: verify owner visual approval, dark/light contrast, 320px headers, app icon at small size, splash on physical iOS/Android, native typecheck and web build; check that reduced motion is static and no startup time is added. Do not merge into a release until checks pass.
