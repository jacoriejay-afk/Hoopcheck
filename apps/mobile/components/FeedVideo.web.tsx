import { useEffect, useRef } from "react";
import { AppState } from "react-native";

// Expo Video's SDK 54 web replace() calls HTMLMediaElement.play() without handling
// its promise. Navigation/source renewal can then cause unhandled AbortErrors.
// Keep the web lifecycle explicit; iOS uses the separately verified native player.
export function FeedVideo({ uri, enabled, loop, onFailure, height }: { height: number; uri: string | null; enabled: boolean; loop: boolean; onFailure: () => void }) {
  const element = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = element.current;
    if (!video) return;
    let active = true;
    const position = video.currentTime;
    const resume = !video.paused && enabled;
    video.pause();
    const loaded = () => {
      if (!active) return;
      if (Number.isFinite(position) && position > 0 && position < video.duration) video.currentTime = position;
      if (resume && enabled && AppState.currentState === "active") {
        void video.play().catch(error => { if (active && error?.name !== "AbortError") onFailure(); });
      }
    };
    const failed = () => { if (active) onFailure(); };
    video.addEventListener("loadedmetadata", loaded);
    video.addEventListener("error", failed);
    if (uri) video.src = uri; else video.removeAttribute("src");
    video.load();
    const appState = AppState.addEventListener("change", state => { if (state !== "active") video.pause(); });
    return () => {
      active = false; video.pause(); appState.remove();
      video.removeEventListener("loadedmetadata", loaded); video.removeEventListener("error", failed);
    };
  }, [uri, enabled, onFailure]);
  return <video ref={element} aria-label="HoopFeed video" controls playsInline loop={loop} disablePictureInPicture style={{ width: "100%", height, objectFit: "contain" }} />;
}
