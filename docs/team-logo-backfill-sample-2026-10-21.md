# Team crest backfill — 10-team dry-run sample
Date: 2026-10-21
Environment: read-only production data lookup; **no storage uploads and no database writes**
Selection: first 10 active teams alphabetically whose `logo_url` is empty.

| Team | Source checked / candidate | Decision | Reason |
|---|---|---|---|
| A.B.B Ego Spor (Türkiye) | Official club site: https://egospor.org.tr/ | SKIP | Official site identified, but a specific crest asset and its dimensions were not independently verified. |
| A++ Massagno (Switzerland) | Club/SAM Basket site: https://www.sambasketmassagno.com/primasquadra | SKIP | Club site confirms the team; source notes the 2026/27 A++ Massagno logo was still to be unveiled, so the current crest could be stale. |
| Abejas de León (Mexico) | Official club site: https://abejasdeleon.com/ | SKIP | Official site identified, but no specific downloadable image asset and dimensions were verified in this sample. |
| Abra Weavers (Philippines) | No authoritative team site confirmed in this sample | SKIP | No reliable official source found; do not guess from similarly named clubs or social thumbnails. |
| ADA Blois Basket 41 (France) | Official club site: https://ada-basket.com/ | SKIP | Official source identified, but the exact image file and pixel dimensions have not yet been validated. |
| Adelaide 36ers (Australia) | Official NBL team page: https://www.nbl.com.au/teams/adelaide-36ers | SKIP | League source identified; direct crest asset URL, download size and dimensions not verified. |
| AE Chalkidas (Greece) | No authoritative team source confirmed in this sample | SKIP | Similar club names exist; avoid uncertain matches. |
| AE Psychiko (Greece) | No authoritative team source confirmed in this sample | SKIP | Similar club names exist; avoid uncertain matches. |
| AEK (Greece) | Official AEK BC source: https://www.aekbc.gr/en/ | SKIP | Possible duplicate/alias of AEK BC; identity must be reconciled before assigning a logo. |
| AEK BC (Greece) | Official club logo announcement: https://www.aekbc.gr/en/the-new-logo-of-aek-betsson-bc/ | SKIP | Official logo source exists, but this report has not yet validated the actual downloadable asset URL, dimensions or storage upload. |

## Sample conclusion
- **Success / production writes: 0**
- **Skipped: 10**
- **Reason:** This is a conservative sample report, not a claim that 10 logos are ready to upload. The script must only promote an image after it confirms a trustworthy source, a non-tiny image, and a sufficiently confident team match.
- **Next step:** Review the source/identity decisions before running any production `--apply` mode. The backfill must copy images into HoopCheck-controlled storage and store only those resulting URLs; third-party hotlinks are not acceptable.

Sources for the official-site checks: A.B.B. EGO Spor official site; SAM Basket Massagno; Abejas de León; ADA Blois; NBL Australia; and AEK BC. The A++ Massagno source specifically reports that the new logo was to be unveiled, so that candidate is intentionally skipped.
