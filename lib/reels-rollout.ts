/**
 * REELS-1 rollout gate. Keep every media mutation disabled until all of:
 *  - database migration and JWT/RLS acceptance tests,
 *  - private storage authorization and media inspection,
 *  - end-to-end publishing and moderation tests
 * have been verified on the target deployment.
 *
 * This is deliberately a constant rather than a user-controlled environment
 * variable: an accidental dashboard setting must not enable unfinished uploads.
 */
export const REELS_MEDIA_UPLOAD_ENABLED = false as boolean;
