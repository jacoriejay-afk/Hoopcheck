/** REELS-1: shared, side-effect-free client/server upload validation.
 * This is only a first-line check. Server must independently verify MIME,
 * media duration, authenticated role, subscription, ownership and storage ACL.
 */
export const REEL_MAX_BYTES = 100 * 1024 * 1024;
export const REEL_MAX_SECONDS = 90;
export const REEL_MAX_CAPTION_LENGTH = 300;
export const REEL_ALLOWED_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

export type ReelTag =
  | { type: "club"; id: string }
  | { type: "league"; id: string }
  | { type: "player"; id: string }
  | null;

export function validateReelInput(input: {
  mimeType: string;
  bytes: number;
  durationSeconds: number;
  caption: string;
  tag: ReelTag;
}): string | null {
  if (!REEL_ALLOWED_MIME_TYPES.includes(input.mimeType as (typeof REEL_ALLOWED_MIME_TYPES)[number]))
    return "Use an MP4, WebM, or MOV video.";
  if (!Number.isSafeInteger(input.bytes) || input.bytes <= 0 || input.bytes > REEL_MAX_BYTES)
    return "Video must be 100 MB or smaller.";
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0 || input.durationSeconds > REEL_MAX_SECONDS)
    return "Video must be 90 seconds or shorter.";
  if (input.caption.length > REEL_MAX_CAPTION_LENGTH)
    return "Caption must be 300 characters or fewer.";
  if (input.tag && (!["club", "league", "player"].includes(input.tag.type) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.tag.id)))
    return "Choose one valid club, league, or player tag.";
  return null;
}
