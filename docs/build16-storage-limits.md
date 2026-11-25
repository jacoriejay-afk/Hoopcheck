# Production storage limits

Use the existing Supabase Storage API credential in the manually dispatched HoopCheck Storage Limits workflow. The PR test job never receives production credentials. Run on main only; default apply=false reads configuration without changing it. If the dry run confirms expected state, run with apply=true. The script checks every target before writing, preserves bucket visibility, rejects unexpected pre-existing limits, updates only four named buckets, and reads settings back after each write.

| Bucket | Limit | Allowed content |
|---|---:|---|
| fan-group-images | 4 MiB | JPEG, PNG, WebP |
| player-verification-documents | 10 MiB | JPEG, PNG, WebP, PDF |
| profile-claim-proofs | 10 MiB | JPEG, PNG, WebP, PDF |
| profile-avatars | 10 MiB | JPEG, PNG, WebP |

Current production catalog inspection: three private target buckets contain zero objects; profile-avatars contains seven JPEG/PNG objects, largest 846676 bytes. No existing object needs deletion. This does not perform malware scanning or make existing public avatar URLs private. MIME limits are defense in depth, not file-content verification. API failures stop further updates; a partial successful application can be rerun idempotently after investigation. No automatic production mutation, paid resources or native submission. Verify upload behavior and bucket catalog after application. The GitHub connector cannot dispatch the workflow; authorized owner must run it from Actions or use the Storage dashboard.
