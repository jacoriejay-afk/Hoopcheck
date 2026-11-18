# Native women's discovery

Adds native `/womens`, `/womens/[id]` and `/womens/leagues/[id]` routes. Men's and
women's directories share one screen with distinct canonical tables, cache keys,
recent searches and profile destinations. Pages use deterministic name/id ordering
and a 41-row lookahead for 40 results, so equal-name teams do not shuffle across
pages. Search filters sanitize punctuation and bound query length.

Women’s profiles expose only public directory fields. Review access comes from
the existing authenticated GET `/api/review-access?entityType=womens-team` API,
using the current session bearer token. The API remains responsible for membership,
moderation, account type and team affiliation. The native client drops content
unless `canReadFull` is explicitly true and offers the existing web review form only
when `canWrite` is true. Review responses are not persisted; offline use hides them.
Auth changes clear access immediately and invalidate in-flight permission results.
No service key, new grants, migrations, membership overrides or production writes
are introduced. The API origin uses EXPO_PUBLIC_HOOPCHECK_API_URL when configured,
otherwise https://hoopcheck.online. Only HTTPS origins without credentials, paths,
queries or fragments are accepted before a token can be sent.

Men’s directory and review screens retain their existing authorization paths. The
shared directory drops an unused website field; women’s schema does not expose it.
The bottom Teams tab now returns from nested profiles to the directory, including
women’s routes. Canonical women’s links and pending sign-in destinations retain IDs.

Validation uses synthetic fetch fixtures only: actual Supabase client requests for
both directories, exact filtering/paging, review permission/error/malformed payload
handling, and canonical deep links. No hosted database or payment calls are made.
TypeScript and changed-file ESLint pass. Native device navigation, real account
permission transitions, both themes, offline restore and server/API compatibility
must still be checked on an isolated candidate environment before release.

This is discovery/profile parity only. Women's review composition still opens the
existing website; no claim of full native parity or release readiness is made.
