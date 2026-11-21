import { useEffect, useRef, useState } from "react";
import { Image, Linking, Text, View } from "react-native";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { supabase } from "../src/lib/supabase";
import { choosePhoto, MediaPermissionError, photoBody, preparePhoto, type Photo } from "../src/native/mediaSelection";
import { saveOwnAvatar } from "../src/native/avatarClient";
export function ProfilePhotoEditor({ userId, enabled }: { userId: string; enabled: boolean }) {
  const theme = useEntryTheme(); const [photo, setPhoto] = useState<Photo | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [permissionDenied, setPermissionDenied] = useState(false);
  const generation = useRef(0); const working = useRef(false);
  useEffect(() => { const current = ++generation.current; return () => { generation.current = current + 1; }; }, [userId]);
  async function run(kind: "choose" | "rotate" | "save") {
    if (working.current || !enabled) return;
    const current = generation.current; working.current = true; setBusy(true); setMessage(""); setPermissionDenied(false);
    try {
      if (kind === "choose") { const selected = await choosePhoto(true); if (current === generation.current && selected) setPhoto(selected); }
      else if (photo && kind === "rotate") { const result = await preparePhoto(photo, true, true); if (current === generation.current) setPhoto(result); }
      else if (photo) {
        const saved = await saveOwnAvatar(supabase, userId, photo, process.env.EXPO_PUBLIC_SUPABASE_URL || "", process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "", photoBody);
        if (current === generation.current) { setPhoto(null); setMessage(saved.status === "approved" ? "Profile photo saved." : saved.status === "pending" ? "Profile photo saved and awaiting review." : "Photo saved. Your profile photo remains hidden under the current moderation decision."); }
      }
    } catch (error) { if (current === generation.current) { setMessage(error instanceof Error ? error.message : "Photo could not be saved. Try again."); setPermissionDenied(error instanceof MediaPermissionError); } }
    finally { if (current === generation.current) { working.current = false; setBusy(false); } }
  }
  return <View style={{ gap: 10 }}><Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 18, fontWeight: "700" }}>Profile photo</Text>
    <Button secondary disabled={busy || !enabled} onPress={() => void run("choose")}>{photo ? "Choose a different photo" : "Choose profile photo"}</Button>
    {photo ? <><Image alt="Profile photo preview" accessibilityLabel="Profile photo preview" source={{ uri: photo.uri }} style={{ height: 160, width: 160, borderRadius: 80, alignSelf: "center" }} /><Button secondary disabled={busy || !enabled} onPress={() => void run("rotate")}>Rotate profile photo</Button><Button disabled={busy || !enabled} onPress={() => void run("save")}>Save profile photo</Button><Button secondary disabled={busy} onPress={() => setPhoto(null)}>Discard selected photo</Button></> : null}
    {busy ? <Text style={{ color: theme.muted }}>Preparing your photo…</Text> : null}
    {permissionDenied ? <Button secondary onPress={() => { void Linking.openSettings().catch(() => setMessage("Open device Settings to allow photo access for HoopCheck.")); }}>Open device Settings</Button> : null}
    {message ? <Text selectable accessibilityRole="alert" style={{ color: theme.foreground }}>{message}</Text> : null}
  </View>;
}
