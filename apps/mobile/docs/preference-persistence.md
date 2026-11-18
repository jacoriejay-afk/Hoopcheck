# Commit device preferences only after durable writes

Previously, `current.current` changed before AsyncStorage.setItem succeeded. If a
user attempted to disable app lock but the write failed, a later haptics/onboarding
change merged against that failed value and could persist the lock as disabled.

The writer now merges each queued patch against the last successfully persisted
state. It commits only after setItem resolves, keeps failures visible to callers,
and permits subsequent queued writes to succeed without inheriting failed values.
Hydration finishes before updates are accepted; stale writers cannot update a
remounted provider. Stored fields are restored through an allowlist rather than
spreading unvalidated JSON. Malformed saved app-lock values or failed storage reads
fail closed, with the existing normal-sign-in fallback available in AppLock.
Fresh installations and valid legacy settings retain their previous defaults.

Four new regressions cover failed lock writes followed by unrelated changes,
queued success/failure, onboarding serialization and malformed/legacy restore.
Mobile TypeScript, native contracts, changed-file ESLint and local iOS export pass.
The exported bundle was checked for the new writer's code after a clean independent
npm ci. Physical storage-failure/device-lock behavior remains a release check.
No production data, permissions, EAS build or OTA changes.
