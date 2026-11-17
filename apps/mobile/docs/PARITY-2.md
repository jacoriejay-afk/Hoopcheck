# PARITY-2 — existing mobile content surfaces

Based on merged PARITY-1, PR #682, commit 6513c89e. The original theme module and primitives remain the single source for mobile styles; primitives are consumed without modification.

## Implemented

- Compact signed-in home section headers and real account-type pill; existing directories/account section order preserved.
- Teams, leagues, coaches and players: paired light/dark surfaces, foregrounds, metadata, error/empty/loading states, shared inputs and load-more buttons. Existing searches run after a 300 ms typing pause, without a Search button. Stale responses cannot overwrite a newer query. Existing filters, sanitization, pagination and player minimum query length are retained.
- Exact TeamLogo initials and FNV colour-hash algorithm; identical SVG hexagonal path, stroke, viewBox and text sizing. Dark directory crest panels have orange team/green league accents. The component also supports the existing theme's women colour; no women's query or navigation was added to the men's-only directories.
- Country flags use a verbatim mirror of lib/countryFlag.ts; unknown countries retain their real label without invented flags. Country pills consume the PARITY-1 Chip.
- Team/league detail hero: crest, country, name and existing metadata in a single column. Existing overview facts and latest reviews remain in order. Review cards use GlassCard. Website/review destinations and review data selection remain unchanged.
- Existing public player profiles use shared cards, inputs and buttons; player role derives from the existing player-only query. All profile fields, report submission behavior and privacy filters remain intact.

## Source references and native substitutions

- Palette/radii/type: app/hoopcheck-theme-tokens.css and PARITY-1 theme.ts. No second palette. New artwork values are added to that same module from the web source.
- Crests: components/TeamLogo.tsx. SVG rendered through Expo SDK 54-compatible react-native-svg rather than browser SVG. Native system sans replaces the web Inter/Arial fallback inside the crest. Native SVG baseline/font metrics may differ; geometry and initials are identical.
- Panels: app/hoopcheck-directory-card-fixes.css (.hc-dir-crest). Solid first gradient stop #1A1A1A replaces its #1A1A1A → #0B0B0B gradient; border #2D2D2D, 14 radius, 6 padding and 4 accent border match the source.
- Heroes: components/TeamProfileHero.tsx. Solid first gradient stop #111827 replaces the web gradient/overlay and decorative watermark; theme-independent white/grey hero ink remains paired with that dark artwork. Cover images/follow/fan-group controls are absent from the mobile data/UI and are not added.
- Country pills use the existing Chip's padding/type/surface rather than introducing a second chip style. Flag glyph appearance is platform-dependent; long labels wrap instead of being clipped.
- Web responsive/multicolumn layouts become single-column native content; the existing mobile spacing/field order is preserved where no equivalent web content exists. Native card shadows/blur/Android opaque fallback inherit PARITY-1 substitutions. No motion added.
- Home hierarchy: app/hoopcheck-ia1-home.css / app/hoopcheck-layout-system.css section hierarchy via shared SectionHeader. No oversized hero or fabricated home metrics.

## Missing mobile capabilities — not implemented in this visual PR

This checkout has no unified grouped search or recent-search store, home search/live/fixture/feed-preview sections, directory filter-chip rows, HoopFeed/composer/post kinds/upgrade screen, signed-in member-profile/Passport screen, profile-completion metrics, subscription display, roster/fixtures tabs, trust-score or pay-index data. No routes, queries, placeholders, controls or fake counts were added for those capabilities. Listed counts still use actual loaded items and indicate pagination with `+`.

The native app does not currently call getHoopCheckEntitlements. Existing detail review reads rely on their existing RLS query path and the write-review link remains as it was. This PR does not introduce, replace, or claim to verify entitlement/affiliation enforcement. The resolver remains untouched in lib/membership-tier.ts. Bringing native access states onto that resolver requires separate implementation beyond visual-only scope. No salary/pay figures were introduced.

## Validation

- `cd apps/mobile && npm run typecheck`
- `node apps/mobile/scripts/verify-parity-2.cjs`: compares crest output with the actual web algorithms, verifies the country lookup mirror, checks semantic and screen-style text contrast in both themes, and compares every existing mobile Supabase query expression against merged PARITY-1.
- `git diff --check`
- Production homepage fetched read-only with HTTP 200; no authenticated production APIs or database changes.

Native device visual/interaction verification is outstanding: no Android SDK/emulator or iOS simulator is configured here. In particular, confirm SVG text baseline, card blur, long countries/names, keyboard/search, pagination, reporting controls and safe-area behavior on both platforms and themes. Automated style checks do not establish full visual parity. Keep this PR draft until those checks and the absent-surface scope are reviewed.
