# Native OAuth and recovery routing repair

Google sign-in registers `hoopcheck://auth/callback`, but redirectSystemPath used
nativeDestination, which previously handed that route to the website. Trusted
OAuth callback and recovery links now stay in the native auth screens. Custom
scheme URLs with or without a hostname/triple slash normalize correctly.

Only PKCE/error fields understood by those screens are forwarded. They are
re-encoded before router parsing, malformed escapes cannot reach the legacy decoder
unchanged, unknown redirect parameters are dropped, and oversized inputs fail
closed. External origins and custom-scheme credentials/ports are rejected.
This is input hardening, not removal of the upstream decoder advisory in #701.

A successful verified OAuth exchange now records the same one-time fresh-sign-in
marker used by password sign-in and honors pending native destinations. The root
layout does not invoke app lock on the OAuth exchange screen itself, preventing a
premature lock before that marker is recorded. Subsequent protected routes retain
the existing app-lock policy. Explicit provider errors cannot exchange a supplied
code, and recovery error text is generic rather than URL-controlled.

Tests cover trusted/external schemes, triple-slash URLs, invalid escapes, length
limits, recovery links, OS URL → redirectSystemPath → actual callback PKCE exchange,
pending destinations, denied callbacks, and app-lock route precedence. Existing
password/callback and native contracts, TypeScript and changed-file ESLint pass.
Physical Google OAuth, recovery-email delivery, Supabase redirect allowlist and
fresh/restored-session app-lock checks remain required before release. No tokens
or account data are put in reports; no EAS build or OTA is published.
