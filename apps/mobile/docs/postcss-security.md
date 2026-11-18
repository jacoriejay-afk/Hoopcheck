# Mobile build-tool security patch

Overrides PostCSS 8.4.49 with 8.5.33, the patched same-major release. Only the
PostCSS lock entry changes; Expo, React Native, native modules and runtimeVersion
remain unchanged. This addresses the PostCSS source-map file-disclosure and CSS
stringification advisories reported by npm audit. No runtime or production data
changes are made.

Validation: clean npm ci, TypeScript, native contracts, auth integration and URL
validation pass; Expo Doctor passes 18/18; local iOS bundle export passes. npm audit
no longer reports PostCSS. The installed dependency graph still reports 32 high and
9 moderate findings (including build tooling). Those findings are not waived by
this patch and do not by themselves establish runtime reachability.

A separate full npm audit fix trial introduced nested incompatible native packages
and increased advisories. It was not adopted. Remaining transitive updates and the
SDK 27/Xcode 27 migration require reviewed compatibility work, tracked in #701.
No EAS builds, OTA updates, signing mutations or hosted database/payment calls.
