import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { signedGroupImage } from "../src/native/clubGroups";
import { useEntryTheme } from "../src/theme";
const project = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
export function GroupImage({ teamId, userId, reference, enabled }: { teamId: string; userId: string; reference: string; enabled: boolean }) {
  const theme = useEntryTheme();
  const scope = `${userId}:${teamId}:${reference}`;
  const [source, setSource] = useState<{ scope: string; uri: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) { setSource(null); return; }
    let valid = true;
    let renewal: ReturnType<typeof setTimeout> | undefined;
    setFailed(false);
    const load = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || data.session?.user.id !== userId) throw new Error("Session changed");
        const uri = await signedGroupImage(supabase, project, teamId, reference);
        if (valid) { setSource({ scope, uri }); renewal = setTimeout(() => setRevision(value => value + 1), 480000); }
      } catch { if (valid) { setSource(null); setFailed(true); } }
    };
    void load();
    return () => { valid = false; clearTimeout(renewal); };
  }, [enabled, teamId, userId, reference, scope, revision]);
  const uri = enabled && source?.scope === scope ? source.uri : null;
  return <View style={{ height: 240, borderRadius: theme.radius.card, backgroundColor: theme.elevatedSurface, overflow: "hidden", justifyContent: "center" }}>
    {failed ? <Pressable accessibilityRole="button" onPress={() => setRevision(value => value + 1)} style={{ minHeight: 48, padding: 12 }}><Text style={{ color: theme.accent }}>Group image unavailable. Tap to retry.</Text></Pressable> : !uri ? <ActivityIndicator accessibilityLabel="Authorizing group image" color={theme.accent} /> : <Image alt="Club group post" accessibilityLabel="Club group post" source={{ uri }} resizeMode="contain" style={{ height: 240, width: "100%" }} onError={() => { setSource(null); setFailed(true); }} />}
  </View>;
}
