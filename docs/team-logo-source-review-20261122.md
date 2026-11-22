# Source audit for international expansion — November 22, 2026

## 2026 directory sources

| Division | Country | Scope | Source |
| --- | --- | ---: | --- |
| Liga Nacional de Básquet 2026–27 | Argentina | 6 missing men's teams | https://deportv.gob.ar/basquetbol/liga-nacional-basquet-202627-calendario-equipos-planteles-nid:17463 |
| La Liga Argentina 2026–27 | Argentina | 34 missing men's teams, both conferences | https://www.unocontraunoweb.com/2026/09/03/la-liga-argentina-confirmo-a-sus-participantes-para-la-temporada-2026-27/ |
| LNBP Femenil 2026 | Mexico | 8 missing women's teams | https://sipse.com/novedades/calor-cancun-femenil-listo-debutar-temporada-2026-lnbp-505444.html |
| Liga de México / LMBPF 2026 | Mexico | 6 missing women's teams | https://deportedigital.mx/la-liga-de-mexico-de-basquetbol-profesional-anuncia-la-temporada-2026-con-seis-equipos-confirmados |

The seed is **data-only** and idempotent. It only adds names absent by country, basketball type and normalized exact name; it does not infer player rosters, scores or club ownership. Women's rows are written to `womens_teams` and mirrored by the existing trigger using identical UUIDs. No image is invented to substitute for an official crest.

## Image source review: small public-domain raster pilot

These are the **only two** new crests prefilled by the data seed, both associated with uniquely identified Argentine basketball clubs. They are not bulk-scraped or copied from a provider API.

| Seed club | Source-file page & rights evidence | Raster URL | Publication notes |
| --- | --- | --- | --- |
| Atenas — Córdoba, Argentina | https://commons.wikimedia.org/wiki/File:Atenas_cordoba_logo.png | https://upload.wikimedia.org/wikipedia/commons/4/49/Atenas_cordoba_logo.png | Commons identifies the A.D. Atenas basketball logo, 228×286 PNG, marks simple shapes/text `PD-textlogo`; still trademark-marked |
| Olímpico La Banda — La Banda, Argentina | https://commons.wikimedia.org/wiki/File:Escudo_del_Club_Ciclista_Ol%C3%ADmpico.png | https://upload.wikimedia.org/wikipedia/commons/4/41/Escudo_del_Club_Ciclista_Ol%C3%ADmpico.png | Commons identifies Club Ciclista Olímpico basketball team and links to its basketball league profile, 1250×1250 PNG, marks `PD-textlogo`; still trademark-marked |

Reviewed in source by HoopCheck directory content audit, **2026-11-22**. This establishes *source identity and the Commons copyright tag*, not endorsement by the clubs or a legal determination for every country. This limited nominative display may be removed by exact club ID on credible rights claim. Public-domain textlogo classification does not remove trademark obligations.

The seed updates only matching `source = 'HoopCheck verified 2026-27 roster'` men’s rows where logo is empty, never overwriting a claimed/previously uploaded logo. Current external Wikimedia URLs are **not yet copied to first-party HoopCheck Storage**; monitor availability. Migrate each independently to the `team-logos` storage bucket when approved and technically available. Do **not** treat these as permission to use every image from Wikimedia or API-Sports.

## Additional candidates held for separate approval

- **Racing Club de Avellaneda**: https://commons.wikimedia.org/wiki/File:Escudo_de_Racing_Club.svg — an exact Racing Club (Argentina) logo with `PD-textlogo` tag, but SVG. Hold for manual sanitization/approved raster. Never use similarly titled Racing Club **Montevideo** crest.
- **River Plate**: https://commons.wikimedia.org/wiki/File:River_Plate_logo.svg — exact Argentine club identity appears likely, but vector source needs manual rights/format inspection before publication.
- **Gimnasia y Esgrima La Plata 2026 vector**: https://commons.wikimedia.org/wiki/File:Escudo_del_Club_de_Gimnasia_y_Esgrima_La_Plata_(v2026).svg — **DO NOT USE:** Commons shows active deletion nomination challenging the free status of the new 2026 artwork.
- **Mexican women’s team crests**: Official league and club pages are candidate references, but league directory/sponsor logos have not been proven commercially licensed to HoopCheck. Keep the initials fallback until approved. Admin Logo Studio has manual team-specific review.

## Operational and rights safeguards

1. Exact identity: men's or women's team, country, name and (when publishing) database UUID.
2. Keep club-owner logos and all existing image URLs intact; no fuzzy overwrite or logo inference from similar sports brands.
3. For broad automated backfill, use `scripts/backfill-team-logos.mjs` with the exact reviewed manifest, raster validation and authorization guard. Do not publish unreviewed candidates.
4. Public-domain copyright and trademark obligations are separate. Do not imply sponsorship or endorsement.
5. Rehearse the seed with transaction rollback; check zero new duplicates on second run, mirrored UUIDs, fan-group integrity and no RLS changes.
