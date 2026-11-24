import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Image, StyleSheet, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import type { ReelVideoSource } from "../../../lib/hoopreels-video-source";

/** Mounted only for the visible Reel and its next two neighbours. expo-video
 * starts buffering a source before the attached view plays. No whole-file
 * download, raw file fallback, or unbounded prefetch. HLS adaptive buffering
 * is provider/native-player controlled, so a first-segment guarantee is not claimed.
 */
export function ReelStreamVideo({ source, active, muted }: { source: ReelVideoSource; active: boolean; muted: boolean }) {
  const input = useMemo(() => ({ uri: source.hlsUrl, contentType: "hls" as const }), [source.hlsUrl]);
  const player = useVideoPlayer(input, value => {
    value.loop = true; value.muted = true; value.timeUpdateEventInterval = 0.25;
    value.bufferOptions = { preferredForwardBufferDuration: 3 };
  });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const visible = useRef(active);
  useEffect(() => { visible.current = active; }, [active]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- imperative native player.
    player.muted = muted;
  }, [muted, player]);
  useEffect(() => {
    if (player.status === "readyToPlay") setReady(true);
    const status = player.addListener("statusChange", e => {
      if (e.status === "readyToPlay") setReady(true);
      if (e.status === "error") { setFailed(true); player.pause(); }
    });
    const time = player.addListener("timeUpdate", e => {
      if (visible.current) setProgress(Math.min(1, Math.max(0, e.currentTime / source.duration)));
    });
    const expires = setTimeout(() => { setFailed(true); player.pause(); }, Math.max(0, Math.min(2_147_000_000, source.expiresAt - Date.now())));
    return () => { clearTimeout(expires); status.remove(); time.remove(); };
  }, [player, source.duration, source.expiresAt]);
  useEffect(() => {
    const sync = () => {
      if (active && !failed && AppState.currentState === "active" && Date.now() < source.expiresAt) player.play();
      else player.pause();
    };
    sync();
    const app = AppState.addEventListener("change", sync);
    return () => { app.remove(); player.pause(); };
  }, [player, active, failed, source.expiresAt]);
  return <View style={StyleSheet.absoluteFill}>
    <Image source={{ uri: source.posterUrl }} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityLabel="Reel poster" />
    {!failed ? <View style={[StyleSheet.absoluteFill, { opacity: ready && active ? 1 : 0 }]}>
      <VideoView player={player} contentFit="contain" style={StyleSheet.absoluteFill} nativeControls={false} allowsFullscreen={false} allowsPictureInPicture={false} />
    </View> : <View style={{ position: "absolute", top: "40%", alignSelf: "center", padding: 12, backgroundColor: "#101928", borderRadius: 12 }}><Text style={{ color: "#FFF" }}>Stream unavailable. Refresh Reels.</Text></View>}
    <View pointerEvents="none" accessibilityLabel="Reel playback progress" style={{ position: "absolute", left: 0, right: 0, bottom: 96, height: 3, backgroundColor: "rgba(255,255,255,0.50)" }}>
      <View style={{ height: 3, backgroundColor: "#FF8645", width: (progress * 100) + "%" as `${number}%` }} />
    </View>
  </View>;
}
