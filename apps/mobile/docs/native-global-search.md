# Native grouped search and homepage entry

Adds a native `/search` route with grouped results across men’s/women’s teams and
leagues, coaches, and eligible public players. The dashboard has the website’s
basketball intelligence heading, a native search input and a women’s directory
entry. No directory totals or activity metrics are invented.

Player queries preserve the existing native directory's account type, public
visibility, normal moderation, professional experience and basketball-side filters.
Only public name/username/country/ID fields are selected. Other directories retain
active filters and men’s/women’s source separation. Input is bounded/sanitized,
results are capped at six per group, stale term results are hidden, and a failed
directory does not conceal successful groups. Offline search asks for reconnect;
no entitlement, review, private account or membership data is queried.

Coaches continue to their canonical web profile because the app has no native
coach detail screen. Other supported results retain their exact native ID route.
Canonical `/search?q=` links keep their search term through native routing.

Synthetic request tests exercise all six queries, eligibility predicates, group
failure isolation, short queries and destination validation. TypeScript and
changed-file ESLint pass. Device visuals, keyboard, scrolling and fast search-term
changes remain unverified here. This does not implement native HoopFeed, Reels,
chat, purchases or account customization and is not full parity.
