// Opt-in connection diagnostic with explicitly leased one-asset moderation request. Never run in production or CI.
import { createPrivateKey, sign } from "node:crypto";
const env = process.env;
if (env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === "feat/hoopreels-1" && env.HOOPREELS_MUX_DIAGNOSTICS === "true") {
  const out = { signingKey: "missing", videoApi: "not-tested", robotsApi: "not-tested", assets: 0, readySignedShortAssets: 0, moderationJobs: 0, approvedModerationJobs: 0, signedManifest: "not-tested", moderationSubmission: "not-requested" };
  const validId = v => typeof v === "string" && /^[A-Za-z0-9_-]{8,120}$/.test(v);
  let signingKey;
  try {
    if (env.MUX_SIGNING_PRIVATE_KEY && validId(env.MUX_SIGNING_KEY_ID)) {
      const raw = env.MUX_SIGNING_PRIVATE_KEY;
      const key = createPrivateKey(raw.includes("-----BEGIN") ? raw.replaceAll("\\n","\n") : Buffer.from(raw,"base64"));
      signingKey = key;
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
      // Only inspect the newest eligible upload, never publish or create assets.
      if (list.status === "ok" && list.data.length <= 10 && eligible.length > 0) {
        const asset = [...eligible].sort((a,b)=>Number(b.created_at)-Number(a.created_at)||a.id.localeCompare(b.id))[0];
        if (signingKey && out.signingKey === "valid-local-format") {
          try {
            const playbackId = asset.playback_ids[0].id;
            const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
            const message = encode({alg:"RS256",typ:"JWT",kid:env.MUX_SIGNING_KEY_ID})+"."+encode({sub:playbackId,aud:"v",exp:Math.floor(Date.now()/1000)+120,kid:env.MUX_SIGNING_KEY_ID});
            const token = message+"."+sign("RSA-SHA256",Buffer.from(message),signingKey).toString("base64url");
            const response = await fetch("https://stream.mux.com/"+playbackId+".m3u8?token="+token,{signal:AbortSignal.timeout(6000)});
            out.signedManifest = response.ok && (await response.text()).startsWith("#EXTM3U") ? "ok" : "http-"+response.status;
          } catch { out.signedManifest = "request-failed"; }
        }
        const jobs = await get("/robots/v1/jobs?workflow=moderate&limit=100&asset_id=" + asset.id);
        out.robotsApi = jobs.status;
        out.moderationJobs = jobs.data.length;
        // A list may omit job outputs. Verify the exact moderation receipt by ID.
        for (const j of jobs.data.slice(0,10)) {
          if (!validId(j.id) || j.status !== "completed") continue;
          const response = await fetch("https://api.mux.com/robots/v1/jobs/moderate/"+j.id,{headers:{Authorization:auth,Accept:"application/json"},redirect:"error",signal:AbortSignal.timeout(6000)});
          if (!response.ok) continue;
          const full = (await response.json()).data;
          if (full?.id === j.id && full.workflow === "moderate" && full.status === "completed" && full.parameters?.asset_id === asset.id && full.parameters?.on_flagged?.action === "delete_playback_ids" && full.outputs?.exceeds_threshold === false) out.approvedModerationJobs++;
        }
        // Owner-authorized one-asset pilot job. Exact commit lease; no retries,
        // no repeated job if any prior job is visible, no public activation.
        // The flag must be explicitly set to this exact preview commit.
        if (env.HOOPREELS_MUX_MODERATION_ONCE === env.VERCEL_GIT_COMMIT_SHA && env.VERCEL_GIT_COMMIT_SHA && /^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA)) {
          if (jobs.status !== "ok" || jobs.data.length !== 0 || out.signedManifest !== "ok") out.moderationSubmission = "skipped-existing-or-unverified";
          else {
            const response = await fetch("https://api.mux.com/robots/v1/jobs/moderate", {
              method:"POST", headers:{Authorization:auth,Accept:"application/json","Content-Type":"application/json"},
              body:JSON.stringify({passthrough:"hoopcheck-free-pilot-one-asset-v1",parameters:{asset_id:asset.id,include_transcript:true,thresholds:{sexual:0.7,violence:0.8},on_flagged:{action:"delete_playback_ids"}}}),
              redirect:"error",signal:AbortSignal.timeout(6000)
            });
            out.moderationSubmission = response.ok ? "accepted" : "http-"+response.status;
          }
        }
      }
    } else out.videoApi = "missing-credentials";
  } catch { out.videoApi = out.videoApi === "not-tested" ? "request-failed" : out.videoApi; out.robotsApi = out.videoApi === "ok" ? "request-failed" : out.robotsApi; }
  // Aggregate diagnostics only: no access tokens, keys, URLs, asset IDs or private content.
  console.log("HOOPREELS_MUX_CONNECTION " + JSON.stringify(out));
}
