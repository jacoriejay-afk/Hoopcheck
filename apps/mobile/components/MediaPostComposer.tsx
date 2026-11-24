import { useEffect, useRef, useState } from "react";
import { Image, Linking, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { capturePhoto, captureVideo, choosePhoto, chooseVideo, MediaPermissionError, photoBody, preparePhoto, uploadVideoFile, type Photo, type Video } from "../src/native/mediaSelection";
import { PublicationUnconfirmed, publishMediaPost } from "../src/native/mediaClient";

type Props = { preferredSource?: "camera" | "library"; userId: string; enabled: boolean; caption: string; token: () => Promise<string>; onPublished: () => void | Promise<void>; onRefresh: () => void | Promise<void> };
export function MediaPostComposer({ userId, enabled, caption, token, onPublished, onRefresh, preferredSource = "library" }: Props) {
  const theme = useEntryTheme(); const [photos, setPhotos] = useState<Photo[]>([]); const [video, setVideo] = useState<Video | null>(null);
  const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [message, setMessage] = useState(""); const [permissionDenied, setPermissionDenied] = useState(false); const [unconfirmed, setUnconfirmed] = useState(false);
  const generation = useRef(0); const controller = useRef<AbortController | null>(null); const working = useRef(false);
  useEffect(() => { const current = ++generation.current; return () => { generation.current = current + 1; controller.current?.abort(); }; }, [userId]);
  useEffect(() => { if (!enabled) controller.current?.abort(); }, [enabled]);
  async function choose(kind: "photo" | "video", rotate?: number, camera = false) {
    if (working.current || !enabled) return;
    const current = generation.current; working.current = true; setBusy(true); setMessage(""); setPermissionDenied(false);
    try {
      if (kind === "video") { const selected = await (camera ? captureVideo() : chooseVideo()); if (current === generation.current && selected) { setVideo(selected); setPhotos([]); setUnconfirmed(false); } }
      else {
        const selected = rotate === undefined ? await (camera ? capturePhoto() : choosePhoto()) : await preparePhoto(photos[rotate], false, true);
        if (current === generation.current && selected) { setPhotos(previous => rotate === undefined ? [...previous, selected].slice(0, 4) : previous.map((photo, index) => index === rotate ? selected : photo)); setVideo(null); setUnconfirmed(false); }
      }
    } catch (error) { if (current === generation.current) { setMessage(error instanceof Error ? error.message : "Media selection failed. Try again."); setPermissionDenied(error instanceof MediaPermissionError); } }
    finally { if (current === generation.current) { working.current = false; setBusy(false); } }
  }
  async function publish() {
    if (working.current || !enabled || unconfirmed) return;
    const current = generation.current; working.current = true; setBusy(true); setUploading(true); setMessage("");
    const abort = new AbortController(); controller.current = abort; const deadline = setTimeout(() => abort.abort(), 120000);
    try {
      const authorization = await token();
      if (current !== generation.current) return;
      await publishMediaPost(process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online", process.env.EXPO_PUBLIC_SUPABASE_URL || "", userId, authorization, caption, photos, video, abort.signal, { photoBody, uploadVideo: uploadVideoFile });
      if (current === generation.current) { setPhotos([]); setVideo(null); setMessage("Published after safety checks."); await onPublished(); }
    } catch (error) { if (current === generation.current) { setMessage(error instanceof Error ? error.message : "Upload failed. Your draft is unchanged."); setUnconfirmed(error instanceof PublicationUnconfirmed); } }
    finally { clearTimeout(deadline); if (current === generation.current) { controller.current = null; working.current = false; setBusy(false); setUploading(false); } }
  }
  return <View style={{ gap: 12 }}>
    <Text style={{ color: theme.muted }}>Add up to four photos, or one video up to 50 MB with a caption. Photos can be cropped when selected and rotated below.</Text>
    <View style={{gap:7}}>
      {Platform.OS!=="web"&&preferredSource==="camera"?<Text accessibilityRole="header" style={{color:theme.foreground,fontFamily:"HoopCheckDisplay",fontSize:20}}>HOOPCHECK CAMERA</Text>:null}
      <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
        {([...((Platform.OS!=="web"&&preferredSource==="camera")?["capturePhoto","captureVideo","photo","video"]:["photo","video",...(Platform.OS!=="web"?["capturePhoto","captureVideo"]:[])])] as string[]).map(kind=>{
          const camera=kind.startsWith("capture"),isVideo=kind.toLowerCase().endsWith("video");
          const label=camera?(isVideo?"Record video":"Take photo"):(isVideo?(video?"Replace video":"Choose video"):"Add photo");
          const disabled=busy||!enabled||(isVideo?photos.length>0:photos.length>=4||Boolean(video));
          return <Pressable key={kind} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={()=>void choose(isVideo?"video":"photo",undefined,camera)}
            style={{minHeight:48,flexBasis:"46%",flexGrow:1,flexDirection:"row",gap:7,alignItems:"center",justifyContent:"center",borderRadius:12,borderWidth:1,borderColor:camera&&preferredSource==="camera"?theme.accent:theme.border,backgroundColor:camera&&preferredSource==="camera"?theme.accentSurface:theme.surface,opacity:disabled?.5:1}}>
            <Ionicons name={camera?(isVideo?"videocam-outline":"camera-outline"):(isVideo?"film-outline":"images-outline")} color={theme.accent} size={21}/><Text style={{color:theme.foreground,fontWeight:"700",fontSize:12}}>{label}</Text>
          </Pressable>;
        })}
      </View>
      {Platform.OS!=="web"&&preferredSource==="camera"?<Text style={{color:theme.muted,fontSize:12}}>Capture using your device camera, preview your media, then post after safety checks.</Text>:null}
    </View>
    {photos.map((photo, index) => <View key={`${photo.uri}:${index}`} style={{ gap: 8 }}><Image alt={`Selected photo ${index + 1}`} accessibilityLabel={`Selected photo ${index + 1}`} source={{ uri: photo.uri }} style={{ height: 180, width: "100%", borderRadius: 12 }} resizeMode="contain" /><View style={{ flexDirection: "row", gap: 8 }}><Button secondary disabled={busy || !enabled} onPress={() => void choose("photo", index)}>Rotate photo {index + 1}</Button><Button secondary disabled={busy} onPress={() => { setPhotos(previous => previous.filter((_, i) => i !== index)); setUnconfirmed(false); }}>Remove photo {index + 1}</Button></View></View>)}
    {video ? <View style={{ gap: 8 }}><Text style={{ color: theme.foreground }}>Selected video · {(video.size / 1024 / 1024).toFixed(1)} MB. Use the system editor when choosing a video to trim it.</Text><Button secondary disabled={busy} onPress={() => { setVideo(null); setUnconfirmed(false); }}>Remove video</Button></View> : null}
    <Button disabled={busy || !enabled || unconfirmed || (!photos.length && !video) || (Boolean(video) && !caption.trim())} onPress={() => void publish()}>{busy ? "Preparing and checking media…" : "Post media"}</Button>
    {uploading ? <Button secondary onPress={() => controller.current?.abort()}>Cancel upload</Button> : null}
    {permissionDenied ? <Button secondary onPress={() => { void Linking.openSettings().catch(() => setMessage("Open your device Settings, allow the required camera or photo access for HoopCheck, and return to try again.")); }}>Open device Settings</Button> : null}
    {unconfirmed ? <Button secondary onPress={() => { void onRefresh(); }}>Refresh and review feed</Button> : null}
    {message ? <Text selectable accessibilityRole="alert" style={{ color: theme.foreground }}>{message}</Text> : null}
  </View>;
}
