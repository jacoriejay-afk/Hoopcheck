import { recoveryMessage } from "../src/native/publicationReceiptCore";
import { publicationReceiptsEnabled,recoverNativePublication,sendWithPublicationReceipt } from "../src/native/publicationReceipt";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Image, Linking, Platform, Pressable, Text, View } from "react-native";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { capturePhoto, captureVideo, choosePhoto, chooseVideo, MediaPermissionError, photoBody, preparePhoto, movePhoto, uploadVideoFile, type CameraFacing, type Photo, type PhotoCrop, type Video } from "../src/native/mediaSelection";
import { PublicationUnconfirmed, publishMediaPost } from "../src/native/mediaClient";
import { FeedVideo } from "./FeedVideo";
import { CommunityWordmark } from "./BrandLockup";
import { HoopCheckCamera } from "./HoopCheckCamera";
import { nativeCameraEnabled } from "../src/native/cameraCapture";

type Props = { preferredSource?: "camera" | "library"; location?: string; userId: string; enabled: boolean; caption: string; token: () => Promise<string>; onPublished: () => void | Promise<void>; onRefresh: () => void | Promise<void> };
export function MediaPostComposer({ userId, enabled, caption, token, onPublished, onRefresh, preferredSource = "library", location = "" }: Props) {
  const theme = useEntryTheme(); const [photos, setPhotos] = useState<Photo[]>([]); const [video, setVideo] = useState<Video | null>(null);
  const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [message, setMessage] = useState(""); const [permissionDenied, setPermissionDenied] = useState(false); const [unconfirmed, setUnconfirmed] = useState(false);
  const [transfer, setTransfer] = useState<number | null>(null);
  const [facing, setFacing] = useState<CameraFacing>("back");
  const [cameraOpen, setCameraOpen] = useState(() => enabled && preferredSource === "camera" && nativeCameraEnabled && Platform.OS !== "web");
  useEffect(() => { if (!enabled) setCameraOpen(false); }, [enabled]);
  const previewFailure = useCallback(() => setMessage("This video could not be previewed. Choose another clip if it does not play."), []);
  const captureScope = useRef({ enabled, userId, revision: 0 });
  useLayoutEffect(() => {
    const previous = captureScope.current;
    captureScope.current = { enabled, userId, revision: previous.revision + (previous.enabled !== enabled || previous.userId !== userId ? 1 : 0) };
  }, [enabled, userId]);
  const generation = useRef(0); const controller = useRef<AbortController | null>(null); const working = useRef(false);
  useEffect(() => { const current = ++generation.current; return () => { generation.current = current + 1; controller.current?.abort(); }; }, [userId]);
  useEffect(() => { if (!enabled) controller.current?.abort(); }, [enabled]);
  async function choose(kind: "photo" | "video", rotate?: number, camera = false, retake?: number) {
    if (working.current || !enabled) return;
    const current = generation.current; const scope = captureScope.current.revision;
    const canAccept = () => current === generation.current && captureScope.current.enabled && captureScope.current.revision === scope;
    working.current = true; setBusy(true); setMessage(""); setPermissionDenied(false);
    try {
      if (kind === "video") { const selected = await (camera ? captureVideo(facing) : chooseVideo()); if (canAccept() && selected) { setVideo(selected); setPhotos([]); setUnconfirmed(false); } }
      else {
        const selected = rotate === undefined ? await (camera ? capturePhoto(facing) : choosePhoto()) : await preparePhoto(photos[rotate], false, true);
        if (canAccept() && selected) { setPhotos(previous => rotate === undefined && retake === undefined ? [...previous, selected].slice(0, 4) : previous.map((photo, index) => index === (rotate ?? retake) ? selected : photo)); setVideo(null); setUnconfirmed(false); }
      }
    } catch (error) { if (current === generation.current) { setMessage(error instanceof Error ? error.message : "Media selection failed. Try again."); setPermissionDenied(error instanceof MediaPermissionError); } }
    finally { if (current === generation.current) { working.current = false; setBusy(false); } }
  }
  async function cropPhoto(index: number, preset: PhotoCrop) {
    const photo = photos[index];
    if (!photo || working.current || !enabled) return;
    const current = generation.current; const scope = captureScope.current.revision;
    const canAccept = () => current === generation.current && captureScope.current.enabled && captureScope.current.revision === scope;
    working.current = true; setBusy(true); setMessage("");
    try {
      const selected = await preparePhoto(photo, false, false, preset);
      if (canAccept()) setPhotos(previous => previous.map((item, i) => i === index && item.uri === photo.uri ? selected : item));
    } catch (error) {
      if (canAccept()) setMessage(error instanceof Error ? error.message : "Crop failed. Your photo is unchanged.");
    } finally {
      if (current === generation.current) { working.current = false; setBusy(false); }
    }
  }
  async function publish() {
    if (working.current || !enabled || unconfirmed) return;
    const current = generation.current; working.current = true; setBusy(true); setUploading(true); setTransfer(null); setMessage("");
    const abort = new AbortController(); controller.current = abort; const deadline = setTimeout(() => abort.abort(), 120000);
    try {
      const authorization = await token();
      if (current !== generation.current) return;
      await sendWithPublicationReceipt(userId,publicationId=>publishMediaPost(process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online", process.env.EXPO_PUBLIC_SUPABASE_URL || "", userId, authorization, caption, photos, video, abort.signal, { photoBody, uploadVideo: (url, headers, clip, signal) => uploadVideoFile(url, headers, clip, signal, fraction => {
        if (current === generation.current && captureScope.current.enabled && !signal.aborted) setTransfer(fraction);
      }) }, location,publicationId));
      if (current === generation.current) { setPhotos([]); setVideo(null); setMessage("Published after safety checks."); await onPublished(); }
    } catch (error) { if (current === generation.current) { setMessage(error instanceof Error ? error.message : "Upload failed. Your draft is unchanged."); setUnconfirmed(error instanceof PublicationUnconfirmed); } }
    finally { clearTimeout(deadline); if (current === generation.current) { controller.current = null; working.current = false; setBusy(false); setUploading(false); setTransfer(null); } }
  }
  async function recover(){
    if(working.current||!enabled)return;
    working.current=true;setBusy(true);
    const current=generation.current;
    try{
      const state=await recoverNativePublication(process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim()||"https://hoopcheck.online",userId,await token());
      if(current!==generation.current)return;
      setUnconfirmed(false);setMessage(state?recoveryMessage(state):"No pending publication.");
      if(state==="published")await onRefresh();
    }catch(error){if(current===generation.current)setMessage(error instanceof Error?error.message:"Publication could not be verified.");}
    finally{if(current===generation.current){working.current=false;setBusy(false);}}
  }
  return <View style={{ gap: 12 }}>
    {cameraOpen && enabled && nativeCameraEnabled && Platform.OS !== "web" ? <HoopCheckCamera key={userId} onClose={() => setCameraOpen(false)} onCapture={capture => {
      if (!captureScope.current.enabled || captureScope.current.userId !== userId || working.current) return false;
      if (capture.kind === "photo") { setPhotos([capture.photo]); setVideo(null); }
      else { setVideo(capture.video); setPhotos([]); }
      setUnconfirmed(false); setMessage("Review your capture and add a caption before posting."); setCameraOpen(false); return true;
    }} /> : null}
    <Text style={{ color: theme.muted }}>Add up to four photos or one video up to 50 MB. Photos preserve their framing unless you crop them. Video quality depends on your device and file size.</Text>
    {Platform.OS !== "web" ? <View style={{ gap: 10, padding: 12, borderWidth: 1, borderColor: preferredSource === "camera" ? theme.accent : theme.border, borderRadius: 16 }}>
      <CommunityWordmark size={20} />
      <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 17, fontWeight: "800" }}>HoopCheck™ Camera</Text>
      <Text style={{ color: theme.muted }}>Capture a photo or a video up to 60 seconds. Review it before posting to HoopFeed. Existing system capture remains available.</Text>
      {nativeCameraEnabled ? <Button secondary disabled={busy || !enabled || unconfirmed || Boolean(photos.length || video)} onPress={() => setCameraOpen(true)}>Open HoopCheck Camera</Button> : null}
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 8 }}>
        {(["back", "front"] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: facing === value, disabled: busy || !enabled }} disabled={busy || !enabled} onPress={() => setFacing(value)} style={{ flex: 1, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: facing === value ? theme.accent : theme.border }}>
          <Text style={{ color: facing === value ? theme.accent : theme.foreground, fontWeight: "700" }}>{value === "back" ? "Rear camera" : "Front camera"}</Text>
        </Pressable>)}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button secondary disabled={busy || !enabled || photos.length >= 4 || Boolean(video)} onPress={() => void choose("photo", undefined, true)}>Take photo</Button>
        <Button secondary disabled={busy || !enabled || photos.length > 0} onPress={() => void choose("video", undefined, true)}>{video ? "Retake video" : "Record video"}</Button>
      </View>
    </View> : null}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button secondary disabled={busy || !enabled || photos.length >= 4 || Boolean(video)} onPress={() => void choose("photo")}>Add photo</Button><Button secondary disabled={busy || !enabled || photos.length > 0} onPress={() => void choose("video")}>{video ? "Replace video" : "Choose video"}</Button></View>
    {photos.map((photo, index) => <View key={`${photo.uri}:${index}`} style={{ gap: 8 }}><Text accessibilityRole="header" style={{ color: theme.foreground, fontWeight: "700" }}>Photo {index + 1} of {photos.length}</Text><Image alt={`Selected photo ${index + 1}`} accessibilityLabel={`Selected photo ${index + 1}`} source={{ uri: photo.uri }} style={{ height: 180, width: "100%", borderRadius: 12 }} resizeMode="contain" /><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}><Button secondary disabled={busy || !enabled} onPress={() => void choose("photo", index)}>Rotate photo {index + 1}</Button>{Platform.OS !== "web" ? <Button secondary disabled={busy || !enabled} onPress={() => void choose("photo", undefined, true, index)}>Retake photo {index + 1}</Button> : null}<Button secondary disabled={busy} onPress={() => { setPhotos(previous => previous.filter((_, i) => i !== index)); setUnconfirmed(false); }}>Remove photo {index + 1}</Button></View><Text style={{ color: theme.muted }}>Center crop (applies to the current photo)</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{([{id:"square",label:"1:1"},{id:"portrait",label:"4:5"},{id:"landscape",label:"4:3"}] as const).map(preset => <Button key={preset.id} secondary accessibilityLabel={`Crop photo ${index + 1} to ${preset.label}`} disabled={busy || !enabled || unconfirmed} onPress={() => void cropPhoto(index, preset.id)}>{preset.label}</Button>)}</View>{photos.length > 1 ? <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8 }}><Button secondary accessibilityLabel={`Move photo ${index + 1} earlier`} disabled={busy || !enabled || unconfirmed || index === 0} onPress={() => { if (!working.current) setPhotos(previous => movePhoto(previous, index, -1)); }}>Move earlier</Button><Button secondary accessibilityLabel={`Move photo ${index + 1} later`} disabled={busy || !enabled || unconfirmed || index === photos.length - 1} onPress={() => { if (!working.current) setPhotos(previous => movePhoto(previous, index, 1)); }}>Move later</Button></View> : null}</View>)}
    {video ? <View style={{ gap: 8 }}>{enabled && !busy ? <FeedVideo key={video.uri} uri={video.uri} enabled={false} loop={false} height={220} onFailure={previewFailure} /> : null}<Text style={{ color: theme.foreground }}>Selected video · {(video.size / 1024 / 1024).toFixed(1)} MB. Use the system editor when choosing a video to trim it.</Text><Button secondary disabled={busy} onPress={() => { setVideo(null); setUnconfirmed(false); }}>Remove video</Button></View> : null}
    <Button disabled={busy || !enabled || unconfirmed || (!photos.length && !video) || (Boolean(video) && !caption.trim())} onPress={() => void publish()}>{busy ? "Preparing and checking media…" : "Post to HoopFeed"}</Button>
    {uploading ? <View style={{ gap: 6 }}>
      <Text accessibilityLiveRegion="polite" style={{ color: theme.foreground }}>{transfer === null ? "Preparing media and checking access…" : transfer < 1 ? `Uploading video · ${Math.floor(transfer * 100)}%` : "Transfer complete · waiting for safety checks…"}</Text>
      {transfer !== null ? <View accessible accessibilityRole="progressbar" accessibilityLabel="Video transfer progress" accessibilityValue={{ min: 0, max: 100, now: Math.floor(transfer * 100) }} style={{ height: 6, borderRadius: 3, backgroundColor: theme.border, overflow: "hidden" }}><View style={{ height: 6, width: `${transfer * 100}%`, backgroundColor: theme.accent }} /></View> : null}
      <Button secondary onPress={() => controller.current?.abort()}>Cancel upload</Button>
    </View> : null}
    {permissionDenied ? <Button secondary onPress={() => { void Linking.openSettings().catch(() => setMessage("Open your device Settings, allow the required camera or photo access for HoopCheck, and return to try again.")); }}>Open device Settings</Button> : null}
    {publicationReceiptsEnabled ? <Button secondary disabled={busy||!enabled} onPress={()=>void recover()}>Check previous publication / cancel if unfinished</Button> : unconfirmed ? <Button secondary onPress={() => { void onRefresh(); }}>Refresh and review feed</Button> : null}
    {message ? <Text selectable accessibilityRole="alert" style={{ color: theme.foreground }}>{message}</Text> : null}
  </View>;
}
