# Build 8 theme verification

The route sweep now exits nonzero for any failed route. Previously it printed
diagnostic `FAIL` records but could still exit successfully.

Fixed actual verified-player badge contrast and theme-preview foreground/surface
pairing. Legacy global ink rules no longer overwrite the preview's local theme
or the badge's fixed dark ink. Preview eyebrows use the accessible theme accent.
The audit parses CSS Color 4 sRGB and composites translucent glass before measuring
contrast; three numerical regressions cover these cases and badge contrast.

The browser audit checks authored visible text so Spanish `Todo` is not mistaken
for a developer `TODO` after CSS capitalization. Control matching accounts for
CSS capitalization, and translated assertions wait for the expected hydrated copy.

Local production website verification on 2026-11-19:

- Next.js production build, bundle/theme-pair gates and six-route Apple CA tracing passed.
- English: **78 PASS, 0 FAIL, 0 NO_MAIN** route/theme results.
- Spanish: **78 PASS, 0 FAIL, 0 NO_MAIN** route/theme results.
- Live language switching passed without a document reload; guest navigation and
  system/light/dark transitions passed. All account/data fixtures were synthetic.
- Numerical color regressions and targeted ESLint passed.

These browser results do not establish native UIKit touch or physical iPhone
behavior. No deployment, migration, OTA, EAS build, submission or merge was run.
