# Admin RPC authorization review — 2026-11-11

Production inspection performed using read-only SQL. **No function or grant changed.**

| RPC | Anonymous EXECUTE | Authenticated EXECUTE | Function-level authorization |
| --- | --- | --- | --- |
| `admin_set_user_role(uuid,text)` | No | Yes | Requires `auth.uid()` to have an `admin_roles` row with role `admin`; validates role and target account; prevents removing last admin |
| `admin_set_membership(uuid,text)` | No | Yes | Calls `is_current_user_admin_or_moderator()`; accepts free/pro/premium; refuses to alter Stripe-linked subscriptions |

## Risk / policy decision
`admin_set_membership` currently permits **moderators** to change local membership entitlements, including Pro and Premium, if the target account has no Stripe subscription ID. This may be deliberate, but it grants a financial-access capability to moderators. Recommended least-privilege policy: restrict this function to admins unless the owner explicitly wants moderators to issue memberships. Do not change silently.

## Verification before production
1. Confirm authorized admin can change an unlinked test account, and a moderator cannot if admin-only is adopted.
2. Confirm ordinary authenticated users and anonymous users cannot invoke either function.
3. Confirm Stripe-linked accounts cannot be modified through `admin_set_membership`.
4. Confirm admin role management refuses removing the last admin.
5. Audit remaining privileged SECURITY DEFINER functions for internal auth checks, search_path safety and unnecessary EXECUTE grants.
6. Validate role QA on real staging JWTs. Never use production memberships as test fixtures.
