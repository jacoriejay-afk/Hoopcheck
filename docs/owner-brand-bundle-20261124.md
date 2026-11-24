# Owner brand bundle — November 24, 2026

Source: owner-uploaded alphabet (A–Z and 0–9, angular pointed terminals) and white open shield, basketball and orange upward arrow reference. Reuse the existing owner-traced wordmark and bundled HoopCheckDisplay fonts, rather than replace them with an approximation font. New symbol is a manual vector redraw of the reference; smoke/background is not part of the identity. Orange: #FF6A00. In-app ink follows theme. App icons use dark backgrounds.

This first integration covers shared web Logo, public SVGs, native welcome and dashboard header, and restrained loader motion. No new dependency, auth, data or entitlement change. Native launcher/splash and PWA PNG assets are updated with matching geometry. Motion respects reduced motion and does not delay navigation. Sub-brand logo variants and physical-device release validation remain separate review items.

QA: verify owner visual approval, dark/light contrast, 320px headers, app icon at small size, splash on physical iOS/Android, native typecheck and web build; check that reduced motion is static and no startup time is added. Do not merge into a release until checks pass.

## Expansion
Native sign-in/sign-up share the lockup; native community headings use traced HoopFeed or the existing display font for HoopReels. Web HoopFeed now uses the same shield. The reusable CheckButton keeps existing authorization and count logic, uses the owner arrow, and suppresses animation on reduced motion. The current feed may use its own Check control; integration of the primitive into additional release branches remains follow-up. Light splash uses a dedicated dark-ink raster; launcher PNG omits unnecessary transparency metadata. No extra dependencies.

## Signature motion expansion
- Takeoff: native shield reveal and independently timed orange arrow; one 500ms sequence with a static reduced-motion path.
- Court Pulse: decorative finite court-line reveal on the existing web loading surface and optional native branded feed skeleton. Existing skeleton delay and data requests are unchanged.
- Confirmed Check: actual native feed action shows the owner arrow and animates the unchecked-to-checked transition after the existing server response. The button's permission, pending, error and count paths remain untouched.
- Pull-to-refresh: native OS indicator uses brand colors; no custom gesture or fake spinner.
- Device rendering, native typecheck, and web checks are still required. The custom basketball refresh gesture, premium reveal, marketing assets and other separate release-branch surfaces remain follow-up.

## Final expansion candidate
Restore established Reels accessibility name. Add compact web HoopChat/HoopGroups sub-brand emblems, one-shot plan accents, verified-live-only Game Night indicator, passport mark and verified-profile badge reveal. Native account shows official mark for confirmed paid membership. Shared-post/reel watermark, achievement unlock integration and device testing remain follow-up. No entitlement changes.
