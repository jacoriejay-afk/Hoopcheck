// Server-only Mux pilot. No upload, billing, or moderation-job creation here.
import { createPrivateKey, sign } from "node:crypto";
import { isReelId, resolveVideoSource, type ReelVideoSource } from "./video-source";

const idPattern = /^[A-Za-z0-9_-]{8,120}$/;
const validId = (v: unknown): v is string => typeof v === "string" && idPattern.test(v);
const disabled = () => ({ configured: false, assets: [] as ReelVideoSource[] });
export const MUX_PILOT_LIMIT = 10;
type Entry = { postId: string; assetId: string; playbackId: string; moderationJobId: string; reviewed: true };
const validEntry = (v: unknown): v is Entry => {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return isReelId(e.postId) && validId(e.assetId) && validId(e.playbackId) && validId(e.moderationJobId) && e.reviewed === true;
};
export async function muxPilotCatalog(env: NodeJS.ProcessEnv, viewer: string, fetcher: typeof fetch = fetch, now = Date.now()) {
  if (env.HOOPREELS_STREAMING_PROVIDER !== "mux" || env.HOOPREELS_PILOT_ENABLED !== "true") return disabled();
  try {
    const allow = (env.HOOPREELS_PILOT_VIEWERS || "").split(",").map(x => x.trim());
    if (!isReelId(viewer) || !allow.every(isReelId) || allow.length > 50 || !allow.includes(viewer)) return disabled();
    const raw = env.HOOPREELS_MUX_PILOT_ASSETS || "";
    if (raw.length > 30000) return disabled();
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries) || entries.length > MUX_PILOT_LIMIT || !entries.every(validEntry)) return disabled();
    for (const field of ["postId", "assetId", "playbackId", "moderationJobId"] as const) {
      if (new Set(entries.map(e => e[field])).size !== entries.length) return disabled();
    }
    const kid = env.MUX_SIGNING_KEY_ID, pem = env.MUX_SIGNING_PRIVATE_KEY, tokenId = env.MUX_TOKEN_ID, tokenSecret = env.MUX_TOKEN_SECRET;
    if (!validId(kid) || !pem || !tokenId || !tokenSecret) return disabled();
    const key = createPrivateKey(pem.includes("-----BEGIN") ? pem.replaceAll("\\n", "\n") : Buffer.from(pem, "base64"));
    if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength || 0) < 2048) return disabled();
    const authorization = "Basic " + Buffer.from(tokenId + ":" + tokenSecret).toString("base64");
    const exp = Math.floor(now / 1000) + 900;
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    function jwt(playbackId: string, aud: "v" | "t") {
      const message = encode({ alg: "RS256", typ: "JWT", kid }) + "." + encode({ sub: playbackId, aud, exp, kid });
      return message + "." + sign("RSA-SHA256", Buffer.from(message), key).toString("base64url");
    }
    async function read(path: string) {
      const response = await fetcher("https://api.mux.com" + path, { headers: { Authorization: authorization, Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error("Provider verification unavailable");
      return (await response.json()).data;
    }
    // Read existing provider receipts only; never start billable jobs on playback.
    // Pending, flagged, missing, errored, or mismatched jobs cannot be published.
    const assets = await Promise.all(entries.map(async e => {
      try {
        const [asset, job] = await Promise.all([read("/video/v1/assets/" + e.assetId), read("/robots/v1/jobs/moderate/" + e.moderationJobId)]);
        if (asset?.id !== e.assetId || asset.status !== "ready" || !Array.isArray(asset.playback_ids) ||
            !asset.playback_ids.some((p: {id?:string;policy?:string}) => p.id === e.playbackId && p.policy === "signed") ||
            asset.playback_ids.some((p: {policy?:string}) => p.policy !== "signed")) return null;
        if (job?.id !== e.moderationJobId || job.workflow !== "moderate" || job.status !== "completed" ||
            job.parameters?.asset_id !== e.assetId || job.parameters?.on_flagged?.action !== "delete_playback_ids" ||
            job.outputs?.exceeds_threshold !== false) return null;
        const track = Array.isArray(asset.tracks) ? asset.tracks.find((t: {type?:string}) => t.type === "video") : null;
        return resolveVideoSource({ provider: "mux", postId: e.postId, playbackId: e.playbackId,
          hlsUrl: "https://stream.mux.com/" + e.playbackId + ".m3u8?token=" + jwt(e.playbackId, "v"),
          posterUrl: "https://image.mux.com/" + e.playbackId + "/thumbnail.jpg?token=" + jwt(e.playbackId, "t"),
          duration: asset.duration, width: track?.max_width, height: track?.max_height, expiresAt: exp * 1000 }, now);
      } catch { return null; }
    }));
    return { configured: true, assets: assets.filter((a): a is ReelVideoSource => Boolean(a)) };
  } catch { return disabled(); }
}
