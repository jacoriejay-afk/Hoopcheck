# PR #836 unsigned iOS failure remediation (2026-11-22)

Exact initial PR head: `fb3722a88ad397f4ea7a5635fbea456b0c22f646`. Original five workflows passed; **Unsigned iOS Native Verification FAILED**, not a skip or an accepted result.

GitHub run [45003046631](https://github.com/jacoriejay-afk/Hoopcheck/actions/runs/45003046631) succeeded on unsigned iOS compile, StoreKit core (4 tests), and the **real light-mode** Passport UI simulator test. It failed on the second (**dark mode**) run at `PassportUITests.swift:28`: status `FAILED`, detail `Your Passport could not be prepared. Try again.` after a bounded print wait. The test generated/uploaded diagnostic evidence and correctly returned exit code 1.

## Isolated hardening (not a bypass)

- Reboot the **same iPhone simulator** between light and dark UI tests to isolate Expo Print/WebKit native state. Both tests still use the real native `Print.printToFileAsync` PDF signature/page/size validation and UIKit share-sheet and cleanup checks.
- Keep the original production 30-second print guard and the CI-only bounded 90-second allowance unchanged.
- When a test fails, record both the accessible smoke status/detail in XCTest and the last 100 lines of the local fixture Metro log to distinguish PDF/native failures from process startup. Preserve failure exit status.
- No production iOS application runtime code, privacy, RLS, billing, membership, entitlements, EAS, Apple signing, or store submission is changed.

## Gates

Re-run all six workflows against the new **exact** PR head and require SUCCESS for each. The real Passport test must pass in **both light and dark**; no skipping or accepting a flaky/retried failure. Only then merge into protected integration with an expected head SHA, and require six fresh post-merge push successes before updating PR #755. Physical iPhone and Apple Sandbox remain unverified.
