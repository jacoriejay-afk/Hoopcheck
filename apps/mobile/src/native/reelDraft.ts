import { REEL_TOPICS, type ReelTopic } from "./mediaClient";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ReelCaptionDraft = { caption: string; topic: ReelTopic };
type DeviceStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
  removeItem(key: string): Promise<unknown>;
};

export function reelDraftKey(userId: string) {
  if (!uuid.test(userId)) throw new Error("Invalid Reel draft account.");
  return "hoopcheck:reel-studio:caption:v1:" + userId;
}
export function parseReelCaptionDraft(raw: string | null): ReelCaptionDraft {
  if (!raw || raw.length > 3500) return { caption: "", topic: "" };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { caption: "", topic: "" };
    const draft = parsed as Record<string, unknown>;
    if (typeof draft.caption !== "string" || draft.caption.length > 2000 ||
      typeof draft.topic !== "string" || (draft.topic && !REEL_TOPICS.includes(draft.topic as typeof REEL_TOPICS[number]))) {
      return { caption: "", topic: "" };
    }
    return { caption: draft.caption, topic: draft.topic as ReelTopic };
  } catch { return { caption: "", topic: "" }; }
}
export async function readReelCaptionDraft(storage: DeviceStorage, userId: string) {
  return parseReelCaptionDraft(await storage.getItem(reelDraftKey(userId)));
}
export async function writeReelCaptionDraft(storage: DeviceStorage, userId: string, draft: ReelCaptionDraft) {
  const key = reelDraftKey(userId);
  if (draft.caption.length > 2000 || (draft.topic && !REEL_TOPICS.includes(draft.topic as typeof REEL_TOPICS[number]))) throw new Error("Invalid Reel draft.");
  if (!draft.caption && !draft.topic) return storage.removeItem(key);
  return storage.setItem(key, JSON.stringify(draft));
}
export async function clearReelCaptionDraft(storage: DeviceStorage, userId: string) {
  return storage.removeItem(reelDraftKey(userId));
}
