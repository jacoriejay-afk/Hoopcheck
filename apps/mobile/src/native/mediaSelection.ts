import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { readWithDeadline } from "./readDeadline";

export type Photo = { uri: string; name: string; type: "image/jpeg"; size: number; width: number; height: number };
export type Video = { uri: string; name: string; type: "video/mp4" | "video/quicktime" | "video/webm"; size: number };
export class MediaPermissionError extends Error {}
function localUri(uri: string) {
  if (!/^(file:|content:|blob:|data:image\/)/.test(uri)) throw new Error("Choose media from your device library.");
  return uri;
}
export type PhotoCrop = "square" | "portrait" | "landscape";
export function centerCrop(width: number, height: number, preset: PhotoCrop) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) throw new Error("Invalid photo dimensions.");
  const [w, h] = preset === "square" ? [1, 1] : preset === "portrait" ? [4, 5] : [4, 3];
  const cropWidth = Math.min(width, Math.max(1, Math.floor(height * w / h)));
  const cropHeight = Math.min(height, Math.max(1, Math.floor(width * h / w)));
  return { originX: Math.floor((width - cropWidth) / 2), originY: Math.floor((height - cropHeight) / 2), width: cropWidth, height: cropHeight };
}
export function movePhoto<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = index + direction;
  if (!Number.isInteger(index) || index < 0 || index >= items.length || next < 0 || next >= items.length) return items;
  const copy = [...items];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}
export async function preparePhoto(input: { uri: string; width: number; height: number }, avatar = false, rotate = false, crop?: PhotoCrop): Promise<Photo> {
  localUri(input.uri);
  if (!Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width < 1 || input.height < 1 || input.width * input.height > 80_000_000) throw new Error("Choose a smaller photo (up to 80 megapixels).");
  const context = ImageManipulator.manipulate(input.uri);
  try {
    if (rotate) context.rotate(90);
    let width = rotate ? input.height : input.width, height = rotate ? input.width : input.height;
    if (avatar || crop) {
      const region = centerCrop(width, height, avatar ? "square" : crop!);
      context.crop(region);
      width = region.width; height = region.height;
    }
    const maximum = avatar ? 720 : 1440;
    if (Math.max(width, height) > maximum) context.resize(width >= height ? { width: maximum } : { height: maximum });
    const rendered = await readWithDeadline(() => context.renderAsync(), 20000);
    try {
      for (const compress of [0.8, 0.55, 0.3]) {
        const result = await readWithDeadline(() => rendered.saveAsync({ format: SaveFormat.JPEG, compress, base64: false }), 20000);
        const size = Platform.OS === "web" ? (await (await fetch(result.uri)).blob()).size : new File(result.uri).size;
        if (Number.isSafeInteger(size) && size > 0 && size <= 750000) return { ...result, name: "photo.jpg", type: "image/jpeg", size };
      }
      throw new Error("This photo is still too large. Choose a smaller image.");
    } finally { rendered.release(); }
  } finally { context.release(); }
}
export async function choosePhoto(avatar = false) {
  // PHPicker grants only the selected asset; no camera, microphone or blanket
  // photo-library permission is needed for the image-only flow.
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: avatar ? [1, 1] : [4, 3], quality: 1, exif: false, base64: false });
  return result.canceled ? null : preparePhoto(result.assets[0], avatar);
}
export async function chooseVideo(): Promise<Video | null> {
  // SDK 54 may need access to the original iOS video. Limited library access is
  // sufficient; never request a camera or microphone for library uploads.
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted && permission.accessPrivileges !== "limited") throw new MediaPermissionError("Allow photo-library access in Settings to choose a video, then try again.");
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"], allowsEditing: true, videoMaxDuration: 180, videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality, exif: false, base64: false });
  if (result.canceled) return null;
  return prepareVideo(result.assets[0]);
}
function prepareVideo(asset: ImagePicker.ImagePickerAsset): Video {
  localUri(asset.uri);
  const type = asset.mimeType === "video/mp4" || asset.mimeType === "video/quicktime" || asset.mimeType === "video/webm" ? asset.mimeType : /\.mov$/i.test(asset.fileName ?? asset.uri) ? "video/quicktime" : /\.mp4$/i.test(asset.fileName ?? asset.uri) ? "video/mp4" : null;
  const size = Platform.OS === "web" ? asset.file?.size ?? asset.fileSize : new File(asset.uri).size;
  if (!type || !Number.isSafeInteger(size) || !size || size < 0 || size > 50 * 1024 * 1024) throw new Error("Choose an MP4, MOV or WebM video up to 50 MB.");
  return { uri: asset.uri, type, size, name: "video." + (type === "video/quicktime" ? "mov" : type === "video/webm" ? "webm" : "mp4") };
}
// Capture is explicitly user-triggered and native-only; it never publishes.
async function requireCamera() {
  if (Platform.OS === "web") throw new Error("Use the HoopCheck app to capture media, or choose a library file.");
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new MediaPermissionError("Allow camera access in device Settings, then try again.");
}
export type CameraFacing = "front" | "back";
function cameraOptions(facing?: CameraFacing) {
  return facing ? { cameraType: facing === "front" ? ImagePicker.CameraType.front : ImagePicker.CameraType.back } : {};
}
export async function capturePhoto(facing?: CameraFacing): Promise<Photo | null> {
  await requireCamera();
  const result = await ImagePicker.launchCameraAsync({ ...cameraOptions(facing), mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 1, exif: false, base64: false });
  return result.canceled ? null : preparePhoto(result.assets[0]);
}
export async function captureVideo(facing?: CameraFacing): Promise<Video | null> {
  await requireCamera();
  const result = await ImagePicker.launchCameraAsync({ ...cameraOptions(facing), mediaTypes: ["videos"], allowsEditing: false, videoMaxDuration: 60, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium, exif: false, base64: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (typeof asset.duration !== "number" || !Number.isFinite(asset.duration) || asset.duration <= 0 || asset.duration > 60000) throw new Error("Record a video of up to 60 seconds.");
  return prepareVideo(asset);
}
export async function photoBody(photo: Photo): Promise<Blob> {
  localUri(photo.uri);
  if (Platform.OS === "web") {
    const blob = await (await fetch(photo.uri)).blob();
    if (blob.size !== photo.size || blob.type !== photo.type) throw new Error("Photo changed. Please choose it again.");
    return blob;
  }
  const file = new File(photo.uri);
  if (!file.exists || file.size !== photo.size) throw new Error("Photo is no longer available. Please choose it again.");
  // React Native fetch/FormData supports a local file descriptor, not a web Blob.
  return { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob;
}
export async function uploadVideoFile(url: string, headers: Record<string, string>, video: Video, signal: AbortSignal, onProgress?: (fraction: number) => void): Promise<{ status: number }> {
  localUri(video.uri); if (signal.aborted) throw new Error("Media upload was cancelled. Your draft is unchanged.");
  if (Platform.OS === "web") return fetch(url, { method: "PUT", headers, body: await (await fetch(video.uri)).blob(), signal, redirect: "error" });
  const file = new File(video.uri);
  if (!file.exists || file.size !== video.size) throw new Error("Video is no longer available. Choose it again.");
  // SDK 54 expo/fetch buffers Blob/streams in JavaScript. Native binary upload
  // uses a file-backed URLSession task so a 50 MB video is not base64/JS buffered.
  const task = FileSystem.createUploadTask(url, video.uri, { httpMethod: "PUT", uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, sessionType: FileSystem.FileSystemSessionType.FOREGROUND, headers }, progress => {
    if (!signal.aborted && progress.totalBytesExpectedToSend > 0 && Number.isFinite(progress.totalBytesSent)) {
      onProgress?.(Math.max(0, Math.min(1, progress.totalBytesSent / progress.totalBytesExpectedToSend)));
    }
  });
  const cancel = () => { void task.cancelAsync().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const result = await task.uploadAsync(); if (signal.aborted) throw new Error("Media upload was cancelled. Your draft is unchanged.");
    if (!result) throw new Error("Video upload was cancelled. Your draft is unchanged.");
    return result;
  } finally { signal.removeEventListener("abort", cancel); }
}
