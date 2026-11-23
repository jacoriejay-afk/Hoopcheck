import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

/**
 * Keep the current video source stable while the card gains or loses focus.
 * Replacing it on every viewability change caused a visible black flash and
 * rewound the stream when scrolling between reels.
 */
export function FeedVideo({ uri, enabled, loop, onFailure, height, muted = loop, controls = true }: { height: number; uri: string | null; enabled: boolean; loop: boolean; onFailure: () => void; muted?: boolean; controls?: boolean }) {
  const player = useVideoPlayer(null, value => { value.loop = loop; value.muted = muted; });
  const playback = useRef({ enabled, loop, uri });
  useEffect(() => { playback.current = { enabled, loop, uri }; }, [enabled, loop, uri]);

  useEffect(() => {
    let alive = true;
    player.pause();
    if (!uri) return () => { alive = false; };
    void player.replaceAsync(uri).then(() => {
      if (alive && playback.current.enabled && playback.current.loop && AppState.currentState === "active") player.play();
    }).catch(() => { if (alive) onFailure(); });
    return () => { alive = false; player.pause(); };
  }, [uri, player, onFailure]);

  useEffect(() => {
    // expo-video's player is an imperative native object.
    // eslint-disable-next-line react-hooks/immutability -- expo-video player is an imperative native object.
    player.loop = loop;
    // Reels always autoplay silently. Ordinary HoopFeed posts keep native controls.
    // eslint-disable-next-line react-hooks/immutability -- expo-video player is an imperative native object.
    player.muted = muted;
    const synchronize = () => {
      if (enabled && loop && uri && AppState.currentState === "active") player.play();
      else player.pause();
    };
    synchronize();
    const appState = AppState.addEventListener("change", synchronize);
    const status = player.addListener("statusChange", event => {
      if (event.status === "error") onFailure();
    });
    return () => { appState.remove(); status.remove(); player.pause(); };
  }, [enabled, loop, muted, uri, player, onFailure]);

  return <VideoView accessibilityLabel={loop ? "HoopFeed Reel" : "HoopFeed video"} player={player} style={{ width: "100%", height }} contentFit="contain" nativeControls={controls} allowsFullscreen allowsPictureInPicture={false} />;
}
