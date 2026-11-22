# HoopCheck Build 9 — Liquid Courtside V3 (native design, not yet released)

## Direction and visual references

Owner feedback on the previous Courtside 2.0 simulator screenshots: too uniform/dull, not distinctively iOS. Reviewed the supplied November 20 HoopCheck website screen recording (Home, HoopFeed, Search, Account/menu) locally, without uploading the recording to GitHub. Grounded design cues: the official condensed HoopCheck wordmark, an airy white website, orange underline/navigation affordances, compact browsing, quick actions, and the site's curved surfaces. No player images or private account data were copied.

## Implementation

- **Shared tokens:** a high-contrast midnight navy/ember dark palette, bright white/light slate alternative, more breathing room, refined rounded cards, consistent premium 24–32px radii.
- **Real native Liquid Glass:** SDK 54-compatible `expo-glass-effect@0.1.10` pins `GlassView` on iOS 26 when *both* compiler/runtime capability APIs return true. Older iOS uses the existing `expo-blur`. Android/web and iOS Reduce Transparency use solid cards. The native module requires a new compiled iOS binary before a real-device acceptance claim. It **cannot** appear in the already-installed Build 7/8 binary.
- **Navigation:** floating 5-tab capsule with real glass where supported, blur/opaque fallback, active indicator with Reanimated, existing safe-area and keyboard handling, touch targets, accessible tab state, and existing haptics.
- **Hero:** stronger editorial court-marking backdrop, warm orange accent light, official HoopCheck condensed display font, compact sport badge and contrast-aware text. Decorative art is the preexisting local court asset, not a real athlete image or game photo.
- **Home:** stronger "Your game. Your world." heading, glass search affordance, and basketball quick-launch tiles. The home game/feed/team displays still use the same actual gated data read paths.
- **HoopFeed:** glass feed/reels switcher, more prominent creator UI and polished post surfaces; privacy, post lifecycle, moderation, checks, commenting and membership remain unchanged.
- **Live Games:** glass segmented basketball-side control and game detail panels; does not invent live scores or change provider status classification.
- **HoopGroups:** clearer glass discovery/joined controls and search.
- **Player Profile:** elevated gradient athlete card, approved avatar/photo only, badge strictly controlled by the existing `player_verified` flag; current team and career stats are never fabricated. Access, owner/other-user privacy, Passport and reporting remain unchanged.
- **Performance/accessibility:** avoids blurring every list row, falls back for Reduce Transparency, respects existing reduced-motion navigation policy, and does not add network requests, analytics, role gates or paid services.

## Non-release status and verification gates

This is a **visual design candidate** on a separate branch. Only the native app's UI, Expo package/lock, a source-regression test, and Vercel preview-disable settings were changed; the website and Supabase migrations stay untouched.

Before integrating into Build 9: use exact-head `npm ci`, React Native TypeScript, native tests, light/dark 320-point visual sweep, accessibility audit, Expo web/iOS/Android exports, and unsigned iOS compile. Review the pinned package tarball integrity (CI's `npm ci` verifies it). Confirm iOS 26 glass on a real device and reduced transparency, older iOS, and Android fallbacks without startup freezes. No EAS/TestFlight release, physical-device sign-off, Apple Sandbox, production deployment or merge to `main` is represented here.

The unrelated Build 9 backend release remains HOLD pending the production-schema-equivalent migration rehearsal, real signed owner/nonowner AAL1/AAL2 tests, Build 7 legacy compatibility, physical iPhone acceptance and Apple Sandbox flows. No stage or production SQL and no billing data should be changed for a design review.
