import { useEffect } from "react";
import { AppState } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
export function FeedVideo({ uri, enabled, loop, onFailure, height }: { height: number; uri: string | null; enabled: boolean; loop: boolean; onFailure: () => void }) {
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
