# Native appearance settings

Settings offers Light, Dark and Use device theme. The persisted device preference
uses the durable writer from #704. One observable app preference updates every
existing useEntryTheme consumer, including the root navigation/status-bar theme;
no second color palette or system-wide appearance change is introduced.
Legacy/invalid appearance settings default to system. Failed writes keep the
current theme and cannot leak the failed choice into a later unrelated save.

Four new unit regressions plus the existing preference/native contracts pass.
TypeScript, changed-file ESLint, both-theme contrast/data-call verifier and local
iOS export pass. The isolated React Native Web flow checks explicit overrides,
reload persistence, device-theme changes, checked accessibility state, failed saves
and a later haptics save. All pass against synthetic account/storage fixtures.

To repeat, export web from apps/mobile with EXPO_PUBLIC_SUPABASE_URL set to
https://fixture.supabase.co and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY set to
fixture-publishable-key, using --clear. Serve the SPA on localhost:8091 with history
fallback, then run scripts/verify-theme-preference-browser.cjs with Playwright and
CHROMIUM_PATH configured. Backend requests are intercepted; other origins abort.
No hosted account, production data, EAS build, OTA or new native module is used.
Physical iPhone appearance, safe areas and device lock remain release checks.
