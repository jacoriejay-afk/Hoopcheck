# Native account/entitlements bootstrap

`GET /api/mobile/bootstrap` accepts a bearer token and verifies it with Supabase
Auth before reading the verified user's own profile/subscription through a
publishable-key client scoped to that token. It uses the existing canonical
membership resolver. Admin authority requires the existing database RPC result;
user-editable metadata and an account_type string cannot grant it.

The response projects only ID, display name, account type and feature entitlements.
It never returns email, token, Stripe identifiers or raw subscription rows. Missing
profiles, authentication errors, query errors and role-check errors fail closed.
All responses are private/no-store. Cookies alone do not authenticate this native
endpoint. It makes no writes, changes no grants/RLS and needs no service-role key.

Five request/handler regressions use synthetic Auth/database fixtures and the real
membership resolver to verify malformed/invalid bearer handling, verified-user
query scoping, metadata-role rejection, expired membership, independently verified
admin access, failure handling and response privacy. The tests are added to CI.
Root production build and changed-file lint pass locally. Real account/RLS tests
against an isolated deployment remain an integration gate; no production account
or data was used during development.
