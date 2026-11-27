import { File, Paths } from "expo-file-system";
import type { Photo, Video } from "./mediaSelection";

export const nativeCameraEnabled = process.env.EXPO_PUBLIC_HOOPCHECK_NATIVE_CAMERA_ENABLED === "true";
export const CAMERA_MAX_BYTES = 50 * 1024 * 1024;
export const CAMERA_MAX_SECONDS = 60;
export type NativeCapture = { kind:"photo"; photo:Photo } | { kind:"video"; video:Video };

/** Only accept/delete temporary files inside the app's own cache. */
export function isCameraCacheFile(uri: string, cache = Paths.cache.uri): boolean {
  try {
    const candidate = new URL(uri), root = new URL(cache);
    const path = decodeURIComponent(candidate.pathname);
    const base = decodeURIComponent(root.pathname).replace(/\/+$/,"") + "/";
    return candidate.protocol === "file:" && root.protocol === "file:" && !candidate.host && !candidate.search && !candidate.hash &&
      !path.includes("\\") && !path.split("/").includes("..") && path.startsWith(base) && path.length > base.length;
  } catch { return false; }
}
export function discardCameraFile(uri: string) {
  if (!isCameraCacheFile(uri)) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Best-effort cleanup of an app-owned temporary capture. */ }
}
export function prepareCameraVideo(uri: string): Video {
  if (!isCameraCacheFile(uri)) throw Error("Camera recording could not be verified.");
  const type = /\.mov$/i.test(uri) ? "video/quicktime" : /\.mp4$/i.test(uri) ? "video/mp4" : null;
  const size = new File(uri).size;
  if (!type || !Number.isSafeInteger(size) || size < 1 || size > CAMERA_MAX_BYTES) throw Error("Record an MP4 or MOV video up to 50 MB.");
  return {uri,type,size,name:type==="video/mp4"?"video.mp4":"video.mov"};
}
