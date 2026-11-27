# iOS native Share Extension candidate (disabled)

Apple-supported share view controller with explicit preview and confirmation. Accepts one exact public HoopCheck directory URL, not arbitrary media, third-party URLs, auth links or private content. No network, automatic app launch or posting. Only an allowlisted route and timestamp are saved. One pending item, ten-minute expiry, atomic replacement/consumption, explicit discard.

This is a **source candidate**, not an installed extension. No App Group ID, bundle identifier, signing entitlement or Xcode target is registered or enabled by this change. Before release: owner-approved App Group and extension identifiers, generated target/config plugin and restrictive URL-only activation rule, main-app receipt preview after authentication/MFA/app-lock, discard on account switch/sign-out, device tests for share/cancel/expiry/relaunch/locked storage, accessibility, and integration with the existing route allowlist. Do not add the unsupported extension-to-host launch technique. A signed build is separately authorized.

References: Apple Share Extension programming guide and App Groups documentation. The independent candidate test workflow checks pure Swift handoff rules and iOS SDK typechecking; it does not establish actual target/signing/device behavior.
