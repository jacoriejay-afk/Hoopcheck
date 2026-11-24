// Opt-in read-only connection diagnostic. Never run in production or CI.
import { createPrivateKey } from "node:crypto";
const env = process.env;
if (env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === "feat/hoopreels-1" && env.HOOPREELS_MUX_DIAGNOSTICS === "true") {
  const out = { signingKey: "missing", videoApi: "not-tested", robotsApi: "not-tested", assets: 0, readySignedShortAssets: 0, moderationJobs: 0, approvedModerationJobs: 0 };
  const validId = v => typeof v === "string" && /^[A-Za-z0-9_-]{8,120}$/.test(v);
  try {
    if (env.MUX_SIGNING_PRIVATE_KEY && validId(env.MUX_SIGNING_KEY_ID)) {
      const raw = env.MUX_SIGNING_PRIVATE_KEY;
      const key = createPrivateKey(raw.includes("-----BEGIN") ? raw.replaceAll("\\n","\n") : Buffer.from(raw,"base64"));
      out.signingKey = key.asymmetricKeyType === "rsa" && (key.asymmetricKeyDetails?.modulusLength || 0) >= 2048 ? "valid-local-format" : "invalid";
    }
  } catch { out.signingKey = "invalid"; }
  try {
    if (env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET) {
      const auth = "Basic " + Buffer.from(env.MUX_TOKEN_ID + ":" + env.MUX_TOKEN_SECRET).toString("base64");
      async function get(path) {
        const response = await fetch("https://api.mux.com" + path, { headers: { Authorization: auth, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(6000) });
        if (!response.ok) return { status: "http-" + response.status, data: [] };
        const json = await response.json();
        return Array.isArray(json.data) ? {status:"ok",data:json.data} : {status:"invalid-response",data:[]};
      }
      const list = await get("/video/v1/assets?limit=11&page=1");
      out.videoApi = list.status;
      out.assets = list.data.length;
      const eligible = list.data.filter(a => validId(a.id) && a.status === "ready" && Number.isFinite(a.duration) && a.duration > 0 && a.duration <= 60 && Array.isArray(a.playback_ids) && a.playback_ids.length > 0 && a.playback_ids.every(p => validId(p.id) && p.policy === "signed"));
      out.readySignedShortAssets = eligible.length;
      if (list.status === "ok" && list.data.length === 1 && eligible.length === 1) {
        const jobs = await get("/robots/v1/jobs?workflow=moderate&limit=20&asset_id=" + eligible[0].id);
        out.robotsApi = jobs.status;
        out.moderationJobs = jobs.data.length;
        out.approvedModerationJobs = jobs.data.filter(j => j.workflow === "moderate" && j.status === "completed" && j.parameters?.asset_id === eligible[0].id && j.parameters?.on_flagged?.action === "delete_playback_ids" && j.outputs?.exceeds_threshold === false).length;
      }
    } else out.videoApi = "missing-credentials";
  } catch { out.videoApi = out.videoApi === "not-tested" ? "request-failed" : out.videoApi; out.robotsApi = out.videoApi === "ok" ? "request-failed" : out.robotsApi; }
  // Aggregate diagnostics only: no access tokens, keys, URLs, asset IDs or private content.
  console.log("HOOPREELS_MUX_CONNECTION " + JSON.stringify(out));
}
