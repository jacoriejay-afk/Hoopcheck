# Post16 repair and compliance reconciliation

Review-only snapshot, not a release candidate or production deployment. Frozen binary source: d6b5e7eae08482c3b2aed6cef7e4b29882142e99. Repair parent: 8d94aa45639a7463841f27cd91577e3377d70733. Compliance parent: 270bfe78e3744b72e329a1a0a670b34ca7da9a4d.

- Preserve all non-overlapping files from both parents. Resolve four overlaps: root navigator (pending social onboarding before public policy bypass, account deletion route retained, network kind sanitized), settings (gated deletion plus staff controls), privacy and terms (retain explicit billing/provider/refund/cancellation/retention distinctions and privacy request path). Regenerate native legal text from reconciled web source.
- No schema migration applied, no flags enabled, no provider activation, no hosted writes, no deployment or paid build.
- Separate Build16 source c5cbdcfe12d3db9d1d1e9455ee25b0dff9f694a2 (native password recovery #1086) is NOT incorporated here. Its overlapping route, auth and legal contracts need a dedicated reconciliation and tests. Do not release this snapshot. Active #1085, #1089, #1092, #1110 and Build17 work remain independent; recheck latest source tips before final acceptance.
- Exact-head full CI, synthetic DB fixtures, native compile, real Passport runtime, signed test environment, physical device, provider configuration, Vercel and owner release approval remain mandatory. Earlier individual PR checks are not combined acceptance. Policy text is a proposed reconciliation requiring owner/legal review.

## Native password recovery reconciliation
The #1086 source is now incorporated in this draft: recovery link filtering and session-bound update, native support and Reel report entry, legal screen and community guidelines, native signup links. Preserves moderation appeals, pinned support reads/writes, pending social signup restrictions and exact return-route whitelist. Canonical privacy/terms deep links use /account/policies while /legal supports all three bundled documents. Fresh CI and signed acceptance remain required. No production changes.
