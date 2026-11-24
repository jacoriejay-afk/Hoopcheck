import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { FeedVideo } from "./FeedVideo";
import { BrandMark } from "./BrandLockup";
import { supabase } from "../src/lib/supabase";
import { authorizedFeedMedia } from "../src/native/feedClient";
import { useEntryTheme } from "../src/theme";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
const project = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
export function FeedMedia({ userId, postId, reference, video = false, enabled, loop = false, height = 300 }: { userId: string; height?: number; postId: string; reference: string; video?: boolean; enabled: boolean; loop?: boolean }) {
  const theme = useEntryTheme();
  const [source, setSource] = useState<{ owner: string; reference: string; uri: string } | null>(null);
  const [imageSize, setImageSize] = useState<{ reference: string; ratio: number } | null>(null);
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fail = useCallback(() => { clearTimeout(expiryRef.current); setError(true); setSource(null); }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let expiry: ReturnType<typeof setTimeout> | undefined;
    setError(false);
    if (!enabled) { setSource(null); return () => { active = false; }; }
    const deadline = setTimeout(() => controller.abort(), 15000);
    const load = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session || data.session.user.id !== userId) throw new Error("Missing session");
        const uri = await authorizedFeedMedia(origin, project, data.session.access_token, postId, reference, controller.signal);
        if (active) { setSource({ owner: userId, reference, uri }); if (!video) { expiry = setTimeout(() => setRevision(value => value + 1), 50000); expiryRef.current = expiry; } }
      } catch { if (active) { setError(true); setSource(null); } }
      finally { clearTimeout(deadline); }
    };
    void load();
    return () => { active = false; controller.abort(); clearTimeout(deadline); clearTimeout(expiry); };
  }, [enabled, userId, postId, reference, revision, video]);
  const uri = enabled && source?.owner === userId && source.reference === reference ? source.uri : null;
  useEffect(() => {
    if (!uri || video) return;
    let active = true;
    Image.getSize(uri, (w, h) => { if (active && w > 0 && h > 0) setImageSize({ reference, ratio: w / h }); }, () => { if (active) fail(); });
    return () => { active = false; };
  }, [uri, video, reference, fail]);
  const ratio = imageSize?.reference === reference ? imageSize.ratio : 4 / 3;
  const mediaHeight = video ? height : Math.min(520, Math.max(120, (width || 320) / ratio));
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: mediaHeight, backgroundColor: theme.elevatedSurface, borderRadius: 14, overflow: "hidden", justifyContent: "center" }}>
    {!enabled ? <Text style={{ color: theme.muted, padding: 16 }}>Media loads when visible.</Text> : error ? <Pressable accessibilityRole="button" onPress={() => setRevision(value => value + 1)} style={{ minHeight: 48, padding: 16 }}><Text style={{ color: theme.accent }}>Media unavailable. Tap to retry.</Text></Pressable> : !uri ? <ActivityIndicator accessibilityLabel="Authorizing media" color={theme.accent} /> : video ? <FeedVideo height={height} uri={uri} enabled={enabled} loop={loop} onFailure={fail} /> : <><Image alt="HoopFeed photo" accessibilityLabel="HoopFeed photo" source={{ uri }} style={{ width: "100%", height: mediaHeight }} resizeMode="cover" onLoad={() => setLoadedUri(uri)} onError={fail} />{loadedUri !== uri ? <ActivityIndicator accessibilityLabel="Loading photo" color={theme.accent} style={{ position: "absolute", alignSelf: "center" }} /> : null}</>}
    {uri && !error && (video || loadedUri === uri) ? <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={{ position: "absolute", top: 8, right: 8, flexDirection: "row", gap: 4, alignItems: "center", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: "rgba(8,8,8,.78)" }}><BrandMark size={18} ink="#F4F4F4" /><Text style={{ color: "#F4F4F4", fontSize: 11, fontWeight: "700" }}>HoopCheck</Text></View> : null}
  </View>;
}
