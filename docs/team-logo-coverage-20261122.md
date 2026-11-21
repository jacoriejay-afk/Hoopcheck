# HoopCheck team-logo coverage — 2026-11-22

## Baseline (read-only production audit)

- `public.teams` has **2,507** rows: **1,872 men** and **635 women**. All **2,507** had a NULL/blank `logo_url` before this task.
- `public.womens_teams` has **214** rows with NULL/blank `logo_url`. Those 214 have mirrors in `public.teams`; they are **not** an additional 214 unique clubs.
- No existing `public.teams.website` values, and only 81 source-linked external IDs. Automated team-name matching alone would be unsafe.
- The admin Logo Studio previously read only 2,000 primary `teams` rows; pagination now covers the complete admin queue, excluding mirrored duplicates in that view.

## Curated live pilot (postflight verified)

- A guarded, atomic production data update assigned **16 exact team records** to seven corresponding Wikimedia Commons crest sources: Boca Juniors, Flamengo, Ferro Carril Oeste, Instituto, Obras Basket, San Lorenzo and Baskonia.
- Updated **12 primary men's rows** and **4 women's source rows**. The existing women's-team mirror trigger populated the corresponding four `teams` records. Read-only postflight reported **12/1,872 men's and 4/635 women's** with image URLs in `teams`; `womens_teams` separately reports **4/214** (these four are mirrors, not additional unique team records).
- Source URLs and identity mappings are recorded in `scripts/team-logo-commons-pilot-20261122.json`. These are external Wikimedia URLs for a limited source-reviewed pilot, **not yet copied into HoopCheck Storage**, and therefore require live image checks before broad rollout.
- Commons file descriptions label the images `PD-textlogo`. Club trademarks may be protected separately, and no endorsement or blanket app-store rights have been established. If a club requests takedown, revert only its exact recorded team IDs. Owner-uploaded official logos always take precedence.
- No provider artwork from FIBA, API-Sports, or TheSportsDB was imported.

## Safe logo publishing policy

1. Team identity must match **exact UUID, table, name and country**, not a normalized fuzzy match.
2. Source image must come from the actual club, a reliable league, or a clearly documented public-domain/authorized source. Do not scrape or automatically adopt search results as official crests.
3. Record an image-specific source page, image URL, **rights evidence link**, review date and reviewer. The provider directory license does not confer logo rights.
4. Use only approved PNG/JPG/WebP assets for the automated importer; hold SVGs and ambiguous brands for manual approval and sanitization.
5. Upload approved raster assets to the public `team-logos` Supabase Storage bucket using unique table/UUID paths. Keep existing logos if present; no bulk overwrite.
6. Do not auto-publish logos with unverified licensing. This includes TheSportsDB, FIBA and API-Sports artwork until commercial usage rights or club permission is documented.
7. The existing `TeamLogo` fallback remains visible for all clubs without an approved image. It is an **initials placeholder**, not a fake official crest.
8. Confirm `womens_teams` updates propagate via the existing mirrored `teams` trigger and do not create a second group.

## Dry-run workflow

Go to GitHub Actions → **HoopCheck Logo Backfill** → Run workflow. Choose country and table; leave **apply=false**. The report lists candidate images only.

For a production batch, first review image identity and usage rights and add exact entries in `scripts/reviewed-team-logo-manifest.json`; then use apply mode in a limited batch with the repository secret and approval gate. Entries missing review evidence will be **skipped**. No rights are claimed by automated discovery. Verify storage URLs, corresponding group profiles and exact postflight counts.

Example shape (illustrative only, **not** a preapproved image):

```json
{
  "entries": [{
    "table": "teams",
    "teamId": "b374ce9f-fe59-46ce-b2af-fafb9552d74f",
    "teamName": "Boca Juniors",
    "country": "Argentina",
    "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/c/c9/Boca_escudo.png",
    "sourcePage": "https://commons.wikimedia.org/wiki/File:Boca_escudo.png",
    "rights": "public-domain",
    "rightsEvidenceUrl": "https://commons.wikimedia.org/wiki/File:Boca_escudo.png",
    "reviewedBy": "reviewer-id",
    "reviewedAt": "2026-11-22",
    "approved": true
  }]
}
```

*Trademark rights remain separate from copyright status: use club identifiers only to label their own team profile; no endorsement implied.*

## Rollback and privacy

Never update `teams` or `womens_teams` logos by loose name-only matches. Any production update must be individually idempotent and auditable; if incorrect, revert only the exact updated IDs and preserve manually uploaded club-owner images. No RLS, profile ownership, subscriptions or Build 9 migration should change for this task.
