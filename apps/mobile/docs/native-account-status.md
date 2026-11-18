# Native verified account status

Adds native `/account` using the read-only `/api/mobile/bootstrap` endpoint from
#706. Account and membership fields come from the verified server response, never
user metadata or a locally inferred tier. The client requires an explicit typed
permission contract, projects only known fields and binds the response user ID to
the current session. Invalid origins, failed/invalid responses and offline use
cannot provide a membership snapshot. Responses are not persisted.

Auth changes, app foregrounding and screen focus invalidate/revalidate account
state. Requests are cancellable with a 15-second deadline and stale auth-generation
responses cannot restore old permissions. Sign-out errors recover the button;
this-device sign-out uses the existing local scope. Public player profile and
device settings remain native; account editing uses the existing website.
No fake purchase/restore buttons or new payment paths are introduced.

Four request/contract regressions cover projection/privacy, malformed permissions,
authenticated no-store requests, server failures and rejecting unsafe API origins
before sending a token. TypeScript, native contracts, changed-file ESLint and local
iOS export pass. Isolated deployment account/RLS and physical-device checks remain
release gates. Profile customization and store purchases are not implemented here.
