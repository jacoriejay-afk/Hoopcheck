import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfilePhotoEditor } from "../../components/ProfilePhotoEditor";
import { Button, GlassCard } from "../../src/primitives";
import { supabase } from "../../src/lib/supabase";
import { useEntryTheme } from "../../src/theme";
import { useNativeAccount } from "../../src/native/useNativeAccount";
import { useNativeDraft } from "../../src/native/drafts";
import { useActiveScreen } from "../../src/native/useActiveScreen";
import { parseProfileDraft, privateProfileRole, profileCovers, readOwnCover, readOwnProfile, saveOwnCover, saveOwnProfile, type EditableProfile, type OwnProfile, type ProfileCover } from "../../src/native/profileEditor";

export default function ProfileEditorScreen() {
  const theme = useEntryTheme(); const { account, loading: accountLoading } = useNativeAccount(); const active = useActiveScreen();
  const uid = account?.user.id; const [draft, setDraft] = useNativeDraft(`profile:edit:${uid}`, uid);
  const values = useMemo(() => { try { return parseProfileDraft(JSON.parse(draft)); } catch { return null; } }, [draft]);
  const [profile, setProfile] = useState<OwnProfile | null>(null); const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  const [cover, setCover] = useState<{ owner: string; value: ProfileCover } | null>(null); const [coverError, setCoverError] = useState("");
  const actionScope = useRef(0);
  useEffect(() => { const scope = ++actionScope.current; setPending(false); setMessage(""); return () => { actionScope.current = scope + 1; }; }, [uid]);
  useEffect(() => {
    if (!uid || !active) return;
    let alive = true; setLoading(true); setMessage(""); setProfile(null);
    void readOwnProfile(supabase, uid).then(result => {
      if (!alive) return; setProfile(result);
      if (!values) setDraft(JSON.stringify(result));
    }).catch(() => { if (alive) setMessage("Your profile could not be loaded. Try again."); }).finally(() => { if (alive) setLoading(false); });
    void readOwnCover(supabase, uid).then(value => { if (alive) { setCover({ owner: uid, value }); setCoverError(""); } }).catch(() => { if (alive) { setCover(null); setCoverError("Your profile cover could not be loaded. Try again."); } });
    return () => { alive = false; };
    // Draft edits must not trigger remote reloads. The memory-only store survives auth revalidation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, active, revision]);
  function change<K extends keyof EditableProfile>(key: K, value: EditableProfile[K]) { if (values) setDraft(JSON.stringify({ ...values, [key]: value })); }
  async function save(kind: "profile" | "cover") {
    if (!uid || pending || !values || profile?.id !== uid) return;
    const owner = uid; const scope = actionScope.current; setPending(true); setMessage("");
    try {
      if (kind === "cover") { if (cover?.owner !== owner) return; await saveOwnCover(supabase, owner, cover.value, process.env.EXPO_PUBLIC_SUPABASE_URL || "", process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""); }
      else await saveOwnProfile(supabase, owner, values);
      if (scope === actionScope.current) setMessage(kind === "cover" ? "Profile cover saved." : "Profile saved.");
    } catch (error) { if (scope === actionScope.current) setMessage(error instanceof Error ? error.message : "Save could not be confirmed. Your draft is unchanged."); }
    finally { if (scope === actionScope.current) setPending(false); }
  }
  const field = (key: keyof typeof fieldNames, max: number, multiline = false) => <View key={key} style={{ gap: 6 }}><Text style={{ color: theme.muted }}>{fieldNames[key]}</Text><TextInput accessibilityLabel={fieldNames[key]} value={values?.[key] || ""} onChangeText={text => change(key, text)} maxLength={max} multiline={multiline} editable={!pending} style={{ minHeight: multiline ? 100 : 48, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 12, color: theme.foreground, backgroundColor: theme.surface, textAlignVertical: "top" }} /></View>;
  const toggle = (key: "free_agent" | "current_country_public", label: string) => <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><Text style={{ color: theme.foreground, flex: 1 }}>{label}</Text><Switch accessibilityLabel={label} value={values?.[key] === true} disabled={pending} onValueChange={value => change(key, value)} trackColor={{ true: theme.accent }} /></View>;
  const canShow = uid && profile?.id === uid && values && !accountLoading && !loading;
  return <SafeAreaView edges={["left", "right", "bottom"]} style={{ flex: 1, backgroundColor: theme.background }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18 }}>
    <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 28, fontWeight: "900" }}>Edit your profile</Text>
    {!canShow ? <><Text style={{ color: theme.muted }}>{accountLoading || loading ? "Loading your profile…" : "Your profile is unavailable. Reconnect and verify your account."}</Text><Button secondary onPress={() => setRevision(value => value + 1)}>Retry profile</Button></> : <>
      <GlassCard><Text style={{ color: theme.foreground }}>{[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Name managed by HoopCheck"}</Text><Text style={{ color: theme.muted }}>{profile.username ? `@${profile.username} · ` : ""}{profile.account_type.replaceAll("_", " ")}</Text><Text style={{ color: theme.muted }}>Identity, role and verification details are managed through verification.</Text></GlassCard>
      <ProfilePhotoEditor key={uid} userId={uid} enabled={!pending && !accountLoading} />
      {cover?.owner === uid ? <><View accessibilityLabel="Profile cover preview" style={{ height: 84, borderRadius: 16, backgroundColor: profileCovers.find(item => item.id === cover.value)?.color }} /><Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 18, fontWeight: "700" }}>Profile cover</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{profileCovers.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.label} cover`} accessibilityState={{ selected: cover.value === item.id }} disabled={pending} onPress={() => setCover({ owner: uid, value: item.id })} style={{ minHeight: 48, padding: 12, borderWidth: 2, borderColor: cover.value === item.id ? theme.accent : theme.border, borderRadius: 12 }}><Text style={{ color: theme.foreground }}>{item.label}</Text></Pressable>)}</View><Button secondary disabled={pending} onPress={() => void save("cover")}>Save profile cover</Button></> : null}
      {coverError ? <Text accessibilityRole="alert" style={{ color: theme.foreground }}>{coverError}</Text> : null}
      {field("display_name", 80)}{field("bio", 500, true)}{field("hometown", 120)}{field("nationality", 80)}
      {profile.account_type === "player" ? <>{field("position", 30)}{field("height", 24)}<Text style={{ color: theme.muted }}>Professional years: {profile.years_pro || "Not set"}. Changes require verification.</Text>{field("current_country", 120)}{toggle("current_country_public", "Show current country publicly")}{toggle("free_agent", "Free agent")}{!values.free_agent ? field("current_team", 160) : null}<Text style={{ color: theme.muted }}>Current team is self-reported. Verified affiliations and review eligibility are handled separately.</Text></> : null}
      {field("favorite_teams", 500)}{field("favorite_leagues", 500)}{field("interests", 500, true)}
      {profile.account_type === "coach" ? field("experience_summary", 1000, true) : null}
      {privateProfileRole(profile.account_type) ? <Text style={{ color: theme.muted }}>Your account uses a private profile.</Text> : <View style={{ gap: 8 }}><Text style={{ color: theme.muted }}>Profile visibility</Text>{(["public", "players_only"] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: values.profile_visibility === value }} disabled={pending} onPress={() => change("profile_visibility", value)} style={{ minHeight: 48, justifyContent: "center", padding: 12, borderWidth: 1, borderColor: values.profile_visibility === value ? theme.accent : theme.border, borderRadius: 12 }}><Text style={{ color: theme.foreground }}>{value === "public" ? "Public profile" : "Players only"}</Text></Pressable>)}</View>}
      <Button disabled={pending} onPress={() => void save("profile")}>{pending ? "Saving…" : "Save profile"}</Button>
      <Button secondary disabled={pending} onPress={() => { setDraft(""); setRevision(value => value + 1); }}>Discard draft and reload</Button>
      <Text style={{ color: theme.muted }}>Unsent profile edits stay on this device during this session and clear when you sign out.</Text>
    </>}
    {message && uid ? <Text accessibilityRole="alert" style={{ color: theme.foreground }}>{message}</Text> : null}
  </ScrollView></SafeAreaView>;
}
const fieldNames = { display_name: "Display name", bio: "Bio", hometown: "Hometown", nationality: "Nationality", favorite_teams: "Favorite teams", favorite_leagues: "Favorite leagues", interests: "Interests and specialties", experience_summary: "Coaching experience", position: "Position", height: "Height", current_country: "Current country", current_team: "Current team" } as const;
