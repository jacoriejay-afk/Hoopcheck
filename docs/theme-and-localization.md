# Theme and localization guardrails

- Global theme tokens live in `app/hoopcheck-preview-system.css` under the **Canonical surface tokens** section. Surface components must use `--hc-page-bg`, `--hc-card-bg`, `--hc-card-border`, `--hc-text-primary`, `--hc-text-secondary`, `--hc-input-bg`, `--hc-input-text`, and `--hc-divider`.
- Do not introduce `bg-white`, `text-black`, inline hex colors, or new hardcoded surface-color declarations in components. `npm run lint` runs `scripts/check-theme-tokens.mjs` to reject newly added violations in the commit diff.
- The root `PreferencesProvider` is the only owner of live theme/language state. Settings must call `setTheme` and `setLanguage`; do not write localStorage or dispatch custom events directly from individual pages.
- Language catalogs currently cover the shared navigation and common settings/search labels in English, Spanish, French, German, Turkish, Portuguese, Italian, Greek, and Arabic. **TODO — human review required:** machine-generated translations in the newly added non-English keys above should be reviewed by fluent speakers before launch. Screen-specific copy not yet routed through `t()` remains a translation-audit task; do not claim full app-wide translation coverage until it is migrated.
- Responsive verification must be run at 390 CSS pixels in both light and dark mode for Dashboard, Search, Teams directory, Team detail, HoopFeed, Profile, and Settings. Save screenshots/recordings as test evidence; a build alone is not visual proof.

## Explicit localization TODOs before launch

- [ ] **Human review:** the non-English strings added to `components/PreferencesProvider.tsx` are machine-generated drafts; review them with fluent speakers for natural wording, basketball terminology, tone, and Arabic RTL layout.
- [ ] **Dashboard:** migrate the remaining hardcoded headings/descriptions and role-specific panels (subscription, fan tools, player connections, coach placement, review history, admin links).
- [ ] **Search:** migrate result counts, empty/error states, country/type filters, player-connection feedback, and all directory-switcher labels.
- [ ] **HoopFeed:** migrate remaining access descriptions, composer helper text, country-sharing helper copy, all aria-labels/tooltips, empty/filter states, time-ago strings, and check/comment permission hints.
- [ ] **Team detail and directory forms:** migrate review/rating labels, competition history, coach states, team request form labels/errors, filters, and pagination.
- [ ] **Profile:** migrate account-type labels, basketball type, career/location fields, empty values, profile completion text, confirmation dialogs, deactivate/delete flows, and public-profile status.
- [ ] **Global chrome and other routes:** migrate footer copy, authentication, membership/checkout, alerts, admin, legal, support, privacy request, and modal strings.
- [ ] **Locale completeness check:** add an automated test that every translation key used by the main screens exists for all nine supported locales and reports any English fallback.
- [ ] **Visual proof:** after a successful deployment, capture 390px screenshots for Dashboard, Search, Teams directory, Team detail, HoopFeed, Profile, and Settings in both themes and at least one non-English locale. This evidence has not yet been captured.
