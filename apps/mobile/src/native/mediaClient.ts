import type { Photo, Video } from "./mediaSelection";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function originUrl(origin: string, path: string) {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Media service configuration is invalid.");
  url.pathname = path; return url;
}
export class PublicationUnconfirmed extends Error {}
// Existing server-authorized HoopFeed topic categories; this does not create a new taxonomy.
export const REEL_TOPICS = ["Practice", "Challenge", "Win", "Teammates", "Culture", "Travel"] as const;
export type ReelTopic = "" | typeof REEL_TOPICS[number];
export type MediaTransport = {
  photoBody: (photo: Photo) => Promise<Blob>;
  uploadVideo: (url: string, headers: Record<string, string>, video: Video, signal: AbortSignal) => Promise<{ status: number }>;
  request?: typeof fetch;
};
export async function publishMediaPost(api: string, project: string, owner: string, token: string, caption: string, photos: Photo[], video: Video | null, signal: AbortSignal, transport: MediaTransport, topicTag: ReelTopic = "") {
  const target = originUrl(api, "/api/hoopfeed/moderate");
  const storage = originUrl(project, "/storage/v1/object/upload/sign/");
  if (!uuid.test(owner) || !token || caption.trim().length > 2000 || (video && !caption.trim()) || (!photos.length && !video) || photos.length > 4 || (photos.length && video)) throw new Error("Choose up to four photos or one video with a caption.");
  if (photos.some(photo => photo.type !== "image/jpeg" || !Number.isSafeInteger(photo.size) || photo.size < 1 || photo.size > 750000) || photos.reduce((total, photo) => total + photo.size, 0) > 3000000) throw new Error("Choose smaller photos before posting.");
  if (video && (!["video/mp4", "video/webm", "video/quicktime"].includes(video.type) || !Number.isSafeInteger(video.size) || video.size < 1 || video.size > 50 * 1024 * 1024)) throw new Error("Choose a supported video up to 50 MB.");
  if (topicTag && !REEL_TOPICS.includes(topicTag as typeof REEL_TOPICS[number])) throw new Error("Choose a supported basketball topic.");
  const request = transport.request ?? fetch;
  const headers = { Authorization: `Bearer ${token}` };
  let uploadPath: string | null = null, moderationStarted = false, definitiveRejection = false;
  try {
    const form = new FormData(); form.append("kind", "post"); form.append("post_kind", "discussion"); form.append("audience", "community"); form.append("text", caption.trim()); if (topicTag) form.append("topic_tag", topicTag);
    for (let index = 0; index < photos.length; index++) form.append(index === 0 ? "image" : "images", await transport.photoBody(photos[index]), "photo.jpg");
    if (video) {
      const response = await request(originUrl(api, "/api/hoopfeed/video-upload"), { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ content_type: video.type, size: video.size }), cache: "no-store", redirect: "error", signal });
      const ticket = await response.json().catch(() => null);
      const extension = video.type === "video/mp4" ? "mp4" : video.type === "video/webm" ? "webm" : "mov";
      const parts = typeof ticket?.path === "string" ? ticket.path.split("/") : [];
      if (!response.ok || ticket?.mode !== "private" || ticket.bucket !== "hoopfeed-private-videos" || parts.length !== 2 || parts[0] !== owner || !parts[1].endsWith(`.${extension}`) || !uuid.test(parts[1].slice(0, -(extension.length + 1))) || typeof ticket.token !== "string" || !ticket.token || ticket.token.length > 8192) throw new Error("Video upload could not be authorized. Your draft is unchanged.");
      uploadPath = ticket.path;
      storage.pathname += "hoopfeed-private-videos/" + uploadPath; storage.searchParams.set("token", ticket.token);
      const uploaded = await transport.uploadVideo(storage.toString(), { "Content-Type": video.type, "x-upsert": "false", "cache-control": "max-age=31536000" }, video, signal);
      if (uploaded.status < 200 || uploaded.status >= 300) throw new Error("Video upload failed. Your draft is unchanged.");
      form.append("video_path", "hoopfeed-private-videos/" + uploadPath); form.append("video_type", video.type);
    }
    if (signal.aborted) throw new Error("Media upload was cancelled. Your draft is unchanged."); moderationStarted = true;
    const response = await request(target, { method: "POST", headers, body: form, cache: "no-store", redirect: "error", signal });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.allowed === true) return;
    definitiveRejection = (response.status >= 400 && response.status < 500 && response.status !== 408) || (response.ok && result?.allowed === false);
    if (!definitiveRejection) throw new PublicationUnconfirmed("Publication could not be confirmed. Refresh and review your feed before creating another post. Your draft is kept.");
    throw new Error(typeof result?.message === "string" ? result.message.slice(0, 300) : "This media could not be published. Your draft is unchanged.");
  } catch (error) {
    // Never remove a file after an uncertain moderation response: the server may
    // already have published it. The cleanup endpoint independently rejects
    // referenced objects and only accepts this captured user's upload paths.
    if (uploadPath && (!moderationStarted || definitiveRejection)) {
      const cleanup = new AbortController(); const deadline = setTimeout(() => cleanup.abort(), 10000);
      try { await request(originUrl(api, "/api/hoopfeed/video-cleanup"), { method: "DELETE", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ path: uploadPath }), redirect: "error", cache: "no-store", signal: cleanup.signal }); } catch { /* Private orphan can be retried/expired server-side; never claim deletion. */ }
      finally { clearTimeout(deadline); }
    }
    if (moderationStarted && !definitiveRejection && !(error instanceof PublicationUnconfirmed)) throw new PublicationUnconfirmed("Publication could not be confirmed. Refresh and review your feed before creating another post. Your draft is kept.");
    throw error;
  }
}
