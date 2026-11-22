# Build 9 Stripe trial + native subscription reconciliation

Source-only candidate; **no production trial enablement**. Three-way base `f8e457055f50abfe1388c82292f05a3f88363f5f`, website main `11792fb0ee7eeb7daac8b44696a1b3946c052e2e`, Build 9 `98e59fa0c0ce24feea32367ddb8cfd874c4169b7`.

Ported 4 nonconflicting main checkout hunks and resolved exactly two cross-edits by retaining BOTH Apple's subscription check, pending-deletion and moderator restrictions AND main's allowed-role/isolated public trial rollout gate. Existing unpriced Fan checkout remains fail-closed. Merged webhook's 3 main-only hunks without source conflicts, preserving native billing/source identity. Retained compact Build 9 membership screen, native Apple billing controls, authentication-race protection; added read-only public-trial-status disclosure and a negative-control regression guard. Do not switch production trial on until signed owner/stripe acceptance.

Review merged behavior and final CI before integrating. Other 19 dual-changed source paths remain unresolved. No Supabase/Stripe API write, EAS, production deploy, or Main branch merge occurred.

## Fixture repair
Checkout source imports the new fail-closed production trial helper; the existing isolated checkout test's virtual module resolver must load the **actual pure helper** (not bypass its gate) to continue verifying fan/moderation/Apple/price negative controls. The five CI fixture failures all originated from unresolved test-module import rather than unsafe checkout results. New exact-head CI required.
