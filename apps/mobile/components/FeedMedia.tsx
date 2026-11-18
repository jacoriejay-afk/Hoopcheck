import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Image, Pressable, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { supabase } from "../src/lib/supabase";
import { authorizedFeedMedia } from "../src/native/feedClient";
import { useEntryTheme } from "../src/theme";
const origin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim() || "https://hoopcheck.online";
const project = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
function AuthorizedVideo({ uri, enabled, loop, onFailure, height }: { height: number; uri: string | null; enabled: boolean; loop: boolean; onFailure: () => void }) {
  const player = useVideoPlayer(null, value => { value.loop = loop; });
  useEffect(() => {
    let active = true;
    const position = player.currentTime;
    const playing = player.playing;
    void player.replaceAsync(uri).then(() => {
      if (!active) return;
      if (Number.isFinite(position) && position > 0) player.currentTime = position;
      if (playing && enabled && AppState.currentState === "active") player.play();
    }).catch(() => { if (active) onFailure(); });
    return () => { active = false; };
  }, [uri, player, enabled, onFailure]);
  useEffect(() => {
    // Expo exposes a mutable native player; this property is its documented control API.
    // eslint-disable-next-line react-hooks/immutability
    player.loop = loop;
    if (!enabled) player.pause();
    const state = AppState.addEventListener("change", next => { if (next !== "active") player.pause(); });
    const status = player.addListener("statusChange", event => { if (event.status === "error") onFailure(); });
    return () => { state.remove(); status.remove(); };
  }, [enabled, player, loop, onFailure]);
  return <VideoView accessibilityLabel="HoopFeed video" player={player} style={{ width: "100%", height }} contentFit="contain" nativeControls allowsFullscreen allowsPictureInPicture={false} />;
}
export function FeedMedia({ postId, reference, video = false, enabled, loop = false, height = 300 }: { height?: number; postId: string; reference: string; video?: boolean; enabled: boolean; loop?: boolean }) {
  const theme = useEntryTheme();
  const [source, setSource] = useState<{ reference: string; uri: string } | null>(null);
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
        if (sessionError || !data.session) throw new Error("Missing session");
        const uri = await authorizedFeedMedia(origin, project, data.session.access_token, postId, reference, controller.signal);
        if (active) { setSource({ reference, uri }); expiry = setTimeout(() => setRevision(value => value + 1), 50000); expiryRef.current = expiry; }
      } catch { if (active) { setError(true); setSource(null); } }
      finally { clearTimeout(deadline); }
    };
    void load();
    return () => { active = false; controller.abort(); clearTimeout(deadline); clearTimeout(expiry); };
  }, [enabled, postId, reference, revision]);
  const uri = enabled && source?.reference === reference ? source.uri : null;
  return <View style={{ height, backgroundColor: theme.elevatedSurface, borderRadius: theme.radius.card, overflow: "hidden", justifyContent: "center" }}>
    {!enabled ? <Text style={{ color: theme.muted, padding: 16 }}>Media loads when visible.</Text> : error ? <Pressable accessibilityRole="button" onPress={() => setRevision(value => value + 1)} style={{ minHeight: 48, padding: 16 }}><Text style={{ color: theme.accent }}>Media unavailable. Tap to retry.</Text></Pressable> : !uri ? <ActivityIndicator accessibilityLabel="Authorizing media" color={theme.accent} /> : video ? <AuthorizedVideo height={height} uri={uri} enabled={enabled} loop={loop} onFailure={fail} /> : <Image alt="HoopFeed photo" accessibilityLabel="HoopFeed photo" source={{ uri }} style={{ width: "100%", height }} resizeMode="contain" onError={fail} />}
  </View>;
}
