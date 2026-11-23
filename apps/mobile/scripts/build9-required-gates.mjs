// Required Build 9 acceptance gates. Do not allow an edited manifest to remove a
// security/compatibility HOLD while retaining enough unrelated checklist entries.
export const REQUIRED_GATE_IDS = Object.freeze([
  "native_feature_integration",
  "expo_identity_structure",
  "production_website",
  "source_main_reconciliation",
  "exact_head_all_ci",
  "startup_passport_fixes",
  "production_schema_rehearsal",
  "owner_mfa_signed_http",
  "private_country_column_boundary",
  "privileged_profile_update_acl",
  "build7_8_compatibility",
  "apple_bundle_signing",
  "physical_iphone",
  "apple_sandbox_subscriptions",
  "security_advisors",
  "owner_release_authorization"
]);

export function missingRequiredGateIds(gates) {
  const present = new Set(Array.isArray(gates) ? gates.map((gate) => gate?.id) : []);
  return REQUIRED_GATE_IDS.filter((id) => !present.has(id));
}
