# PARITY-1 implementation notes

Source: app/hoopcheck-theme-tokens.css (semantic palette and radii), app/globals.css (role palette), app/styles/liquid-glass.css (glass border and shadow), app/hoopcheck-brand-home.css (headline tracking). Production homepage was reachable (HTTP 200) during implementation.

Canonical page colours are #000000 dark / #F4F4F1 light, differing from the brief's #0A0A0A / #F7F7F5. Accent text uses the web's accessible #B83E14 / #FF8A5C; action fill remains #FF5A1F with #111111 ink. Raised surfaces are #FFFFFF / #171717; soft surfaces #F8F8F6 / #1B1B1B. Control/card/hero radii: 12/16/20.

Native substitutions:
- Existing bundled HoopCheck mark asset retained; remove the independently typeset wordmark. No asset recolouring or recreation.
- The exact web display font is decoded from app/hoopcheck-display.woff2 to TTF for expo-font. Body uses platform system sans (web sans fallback equivalent); Inter is not bundled in this repo.
- CSS blur(12px) becomes expo-blur intensity 12 on iOS (intensity is not a CSS pixel equivalent). CSS saturate(135%) has no native counterpart and is omitted. Android uses the opaque semantic surface. Web translucent fill is 92% of the raised surface.
- Web shadow 0 12px 32px with .12/.32 opacity maps to native shadow properties; Android elevation 8 is an approximation, not a pixel-equivalent CSS shadow.
- Responsive CSS headline sizing uses 48 native points with -.035em tracking. Native line wrapping replaces CSS text-wrap:balance; weight 950 uses the actual bundled display face at its declared weight 400.
- Native safe areas, Stack headers and status bar replace browser sticky positioning. No new navigation. This checkout has no tab navigator or badge implementation, so neither was invented.
- Browser background hero gradients and decorative angled stripe are replaced with the semantic glass surface; no gradient or motion dependency introduced.

Verification: mobile npm run typecheck; git diff --check; programmatic WCAG AA checks for primary/secondary text, inputs, links, buttons and chips in both themes. Auth requests, validation and route destinations remain intact; only displayed backend error fallbacks changed.

Remaining review: device screenshots and interactive checks on iOS and Android in both themes, including large text, keyboard, notch/status-bar and recovery links. No native simulator is configured in this workspace. This is a draft until that visual review is complete; production HTML retrieval does not establish visual parity.
