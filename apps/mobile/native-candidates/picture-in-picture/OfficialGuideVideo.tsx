import { useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, Text, View } from "react-native";
import { VideoView, useVideoPlayer, isPictureInPictureSupported } from "expo-video";
import { officialCatalog, reviewedOfficialAsset } from "./officialVideoPolicy";

// Unmounted on session change, sign-out, opt-out or navigation away. The host
// must pass an authenticated unlocked session and use a session-specific key.
// No app route or config plugin enables this candidate.
export function OfficialGuideVideo({ videoId, activeSession }: {videoId: string; activeSession: boolean}) {
  const enabled = process.env.EXPO_PUBLIC_HOOPCHECK_OFFICIAL_VIDEO_PIP_ENABLED === "true";
  const supported = (Platform.OS === "ios" || Platform.OS === "android") && isPictureInPictureSupported();
  const asset = reviewedOfficialAsset(officialCatalog, videoId, enabled, activeSession, supported);
  if (asset === null) return <Text>Picture-in-picture is unavailable for this video.</Text>;
  return <ApprovedVideo key={asset} asset={asset} />;
}
function ApprovedVideo({asset}: {asset:number}) {
  const player = useVideoPlayer(asset, value => { value.loop = false; value.staysActiveInBackground = false; });
  const view = useRef<VideoView>(null);
  const permitted = useRef(false);
  const floating = useRef(false);
  const busy = useRef(false);
  const [message,setMessage] = useState("");
  const [starting,setStarting] = useState(false);
  useEffect(() => {
    permitted.current = true;
    const nativeView = view.current;
    const pauseOutside = () => {
      if (AppState.currentState !== "active" && !floating.current) player.pause();
    };
    const subscription = AppState.addEventListener("change",pauseOutside);
    return () => {
      permitted.current = false;
      floating.current = false;
      player.pause();
      // No private media can be displayed even if a system close is delayed.
      if (nativeView) void nativeView.stopPictureInPicture().catch(()=>{});
      subscription.remove();
    };
  },[player]);
  const start = async () => {
    const nativeView = view.current;
    if (!permitted.current || !nativeView || busy.current || floating.current || AppState.currentState !== "active") return;
    busy.current = true; setStarting(true); setMessage("");
    try {
      player.staysActiveInBackground = true;
      await nativeView.startPictureInPicture();
      if (!permitted.current) {
        player.pause();
        await nativeView.stopPictureInPicture().catch(()=>{});
      }
    } catch {
      player.pause();
      if (permitted.current) { player.staysActiveInBackground = false; setMessage("Picture-in-picture could not start on this device."); }
    } finally {
      busy.current = false;
      if (permitted.current) setStarting(false);
    }
  };
  const stopped = () => {
    floating.current = false;
    if (!permitted.current) return;
    player.staysActiveInBackground = false;
    if (AppState.currentState !== "active") player.pause();
  };
  return <View>
    <VideoView ref={view} player={player} style={{width:"100%",height:220}} nativeControls
      allowsPictureInPicture startsPictureInPictureAutomatically={false}
      onPictureInPictureStart={() => {
        if (!permitted.current) { player.pause(); void view.current?.stopPictureInPicture().catch(()=>{}); return; }
        floating.current = true; player.staysActiveInBackground = true;
      }} onPictureInPictureStop={stopped} />
    <Pressable accessibilityRole="button" accessibilityLabel="Open official video in picture-in-picture" disabled={starting} onPress={()=>void start()} style={{minHeight:44,padding:12}}>
      <Text>Picture-in-picture</Text>
    </Pressable>
    {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
  </View>;
}
