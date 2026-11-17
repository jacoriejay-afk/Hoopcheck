import { GlassCard, Button, Chip } from "../../src/primitives";
import { ShareSheet } from "../../components/ShareSheet";
import { Sheet } from "../../components/Sheet";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useHaptics } from "../../src/native/haptics";
import { useCachedRead, useNetwork, requireOnline } from "../../src/native/network";
import { OfflineBanner } from "../../components/OfflineBanner";
import { Skeleton } from "../../components/Motion";
import { useEntryTheme, type EntryTheme } from "../../src/theme";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";

type PlayerProfile = {
  id: string; display_name: string | null; username: string | null; country: string | null;
  current_country: string | null; current_team: string | null; position: string | null;
  years_pro: number | null; free_agent: boolean; bio: string | null; hometown: string | null;
  nationality: string | null; experience_summary: string | null; basketball_type: "mens" | "womens" | null;
};

export default function PlayerDetailScreen() {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const haptic = useHaptics();
  const { read, savedAt } = useCachedRead();
  const { revision, offline } = useNetwork();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshId, setRefreshId] = useState(0);
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoading(true); setError("");
      const { data, error: queryError } = await read(`players:profile:${id}`, () => supabase.from("profiles")
        .select("id,display_name,username,country,current_country,current_team,position,years_pro,free_agent,bio,hometown,nationality,experience_summary,basketball_type")
        .eq("id", id)
        .eq("account_type", "player")
        .eq("profile_visibility", "public")
        .eq("moderation_status", "normal")
        .in("basketball_type", ["mens", "womens"])
        .eq("professional_experience", true)
        .maybeSingle());
      if (!active) return;
      if (queryError || !data) {
        setError("This profile is unavailable or is no longer public.");
        setPlayer(null);
      } else {
        setPlayer(data as PlayerProfile);
      }
      setLoading(false);
      setRefreshing(false);
    }
    if (id) void load(); else { setError("This profile link is invalid."); setLoading(false); }
    return () => { active = false; };
  }, [id, revision, refreshId, offline, read]);

  async function submitReport() {
    const reason = reportReason.trim();
    if (reason.length < 1 || reason.length > 500 || !player) {
      setReportMessage("Please enter a reason of 1–500 characters.");
      return;
    }
    const apiOrigin = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim().replace(/\/$/, "");
    if (!apiOrigin) {
      setReportMessage("Reporting is temporarily unavailable because the app API is not configured.");
      return;
    }
    setReportSubmitting(true);
    setReportMessage("");
    try {
      await requireOnline();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        setReportMessage("Please sign in again before reporting this profile.");
        return;
      }
      const response = await fetch(`${apiOrigin}/api/profile-reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ profileId: player.id, reason }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; ok?: boolean };
      if (!response.ok) {
        haptic("error");
        setReportMessage(result.error || "We couldn't submit your report. Please try again.");
        return;
      }
      haptic("posted");
      setReportReason("");
      setReporting(false);
      setReportMessage("Report submitted. Thank you for helping keep HoopCheck safe.");
    } catch {
      haptic("error");
      setReportMessage("Couldn't connect to HoopCheck. Check your connection and try again.");
    } finally {
      setReportSubmitting(false);
    }
  }

  const name = player?.display_name || (player?.username ? `@${player.username}` : "Player profile");
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <OfflineBanner savedAt={savedAt} />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setRefreshId(value => value + 1); }} />} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back to players</Text></Pressable>
        {loading ? <Skeleton profile /> : error ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>Profile unavailable</Text><Text style={styles.body}>{error}</Text><Button style={styles.button} onPress={() => router.replace("/players")}><Text style={styles.buttonText}>Return to player search</Text></Button></View>
        ) : player ? (
          <>
            <GlassCard style={styles.hero}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0,1).toUpperCase()}</Text></View>
              <View style={{ alignSelf: "flex-start" }}><Chip>Player</Chip></View>
              <Text style={styles.kicker}>PUBLIC {player.basketball_type === "womens" ? "WOMEN'S" : "MEN'S"} PLAYER PROFILE</Text>
              <Text style={styles.heroTitle}>{name}</Text>
              <ShareSheet title={name} path={`/players/${player.id}`} />
              {player.username && player.display_name ? <Text style={styles.handle}>@{player.username}</Text> : null}
              {player.free_agent ? <View style={styles.pill}><Text style={styles.pillText}>FREE AGENT</Text></View> : null}
            </GlassCard>
            <GlassCard style={styles.card}>
              <Text style={styles.sectionTitle}>Player details</Text>
              <Info label="Current team" value={player.current_team} />
              <Info label="Current country" value={player.current_country || player.country} />
              <Info label="Position" value={player.position} />
              <Info label="Professional experience" value={player.years_pro === null ? null : `${player.years_pro} ${player.years_pro === 1 ? "year" : "years"}`} />
              <Info label="Nationality" value={player.nationality} />
              <Info label="Hometown" value={player.hometown} />
            </GlassCard>
            {player.bio?.trim() ? <GlassCard style={styles.card}><Text style={styles.sectionTitle}>About</Text><Text style={styles.body}>{player.bio.trim()}</Text></GlassCard> : null}
            {player.experience_summary?.trim() ? <GlassCard style={styles.card}><Text style={styles.sectionTitle}>Experience</Text><Text style={styles.body}>{player.experience_summary.trim()}</Text></GlassCard> : null}
            <GlassCard style={styles.reportCard}>
              <Text style={styles.sectionTitle}>Safety and reporting</Text>
              <Text style={styles.body}>If this profile contains impersonation, harassment, or inappropriate personal information, report it to the HoopCheck team.</Text>
              {(
                <Button accessibilityRole="button" style={styles.reportButton} onPress={() => { setReporting(true); setReportMessage(""); }}>
                  <Text style={styles.reportButtonText}>Report this profile</Text>
                </Button>
              )}
              <Sheet open={reporting} onClose={() => setReporting(false)} title="Report profile">
                <View style={styles.reportForm}>
                  <Text style={styles.label}>Why are you reporting this profile?</Text>
                  <BottomSheetTextInput
                    accessibilityLabel="Reason for reporting profile"
                    value={reportReason}
                    onChangeText={setReportReason}
                    placeholder="Describe the concern (1–500 characters)"
                    placeholderTextColor={theme.muted}
                    multiline
                    maxLength={500}
                    textAlignVertical="top"
                    style={styles.reportInput}
                  />
                  {reportMessage ? <Text accessibilityRole="alert" style={styles.reportMessage}>{reportMessage}</Text> : null}
                  <Text style={styles.characterCount}>{reportReason.trim().length}/500</Text>
                  <View style={styles.reportActions}>
                    <Button secondary disabled={reportSubmitting} style={styles.cancelButton} onPress={() => { setReporting(false); setReportReason(""); setReportMessage(""); }}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </Button>
                    <Pressable disabled={reportSubmitting || !reportReason.trim()} style={[styles.reportButton, (reportSubmitting || !reportReason.trim()) && styles.disabledButton]} onPress={() => void submitReport()}>
                      <Text style={styles.reportButtonText}>{reportSubmitting ? "Submitting…" : "Submit report"}</Text>
                    </Pressable>
                  </View>
                </View>
              </Sheet>
              {reportMessage ? <Text accessibilityRole="alert" style={styles.reportMessage}>{reportMessage}</Text> : null}
            </GlassCard>
            <Text style={styles.footer}>Only fields intended for public profile display are shown. Profile availability follows the player’s privacy and moderation settings. Verify roster and free-agent status independently.</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string | number | null | undefined }) {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  if (value === null || value === undefined || value === "") return null;
  return <View style={styles.infoRow}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

const createStyles = (theme: EntryTheme) => StyleSheet.create({
  safe: {flex:1,backgroundColor: theme.background},content: {padding:18,paddingBottom:34},back: {color: theme.accent,fontSize:15,fontWeight:"800",marginBottom:18},hero: {backgroundColor: theme.surface,borderRadius:16,padding:22,alignItems:"flex-start",marginBottom:14},avatar: {width:60,height:60,borderRadius:18,backgroundColor: theme.chip,alignItems:"center",justifyContent:"center",marginBottom:15},avatarText: {fontSize:26,fontWeight:"900",color: theme.onChip},kicker: {fontSize:10,fontWeight:"900",letterSpacing:1.4,color: theme.accent},heroTitle: {fontSize:26,fontWeight: "400", fontFamily: "HoopCheckDisplay",color: theme.foreground,marginTop:5},emptyTitle: {fontSize:22,fontWeight:"900",color: theme.foreground,textAlign:"center"},handle: {color: theme.muted,fontSize:14,marginTop:4},pill: {backgroundColor: theme.chip,borderRadius:20,paddingHorizontal:10,paddingVertical:5,marginTop:12},pillText: {color: theme.onChip,fontSize:10,fontWeight:"900",letterSpacing:0.7},card: {backgroundColor: theme.surface,borderRadius: theme.radius.card,padding:17,marginBottom:12,borderWidth:1,borderColor: theme.border},sectionTitle: {fontSize:16,fontWeight:"900",color: theme.foreground,marginBottom:12},infoRow: {paddingVertical:9,borderBottomWidth:1,borderBottomColor: theme.border,gap:4},label: {fontSize:11,fontWeight:"800",color: theme.muted,textTransform:"uppercase",letterSpacing:0.5},value: {fontSize:15,color: theme.foreground,fontWeight:"600"},body: {fontSize:14,lineHeight:21,color: theme.muted},footer: {fontSize:12,lineHeight:18,color: theme.muted,textAlign:"center",paddingHorizontal:4,marginTop:4},loader: {marginTop:60},empty: {backgroundColor: theme.surface,padding:22,borderRadius: theme.radius.card,alignItems:"center"},button: {backgroundColor: theme.button,padding:13,borderRadius: theme.radius.control,marginTop:16},buttonText: {color: theme.onButton,fontWeight:"900"},reportCard: {backgroundColor: theme.surface,borderRadius: theme.radius.card,padding:17,marginBottom:12,borderWidth:1,borderColor: theme.border},reportButton: {backgroundColor: theme.button,paddingHorizontal:14,paddingVertical:12,borderRadius: theme.radius.control,alignItems:"center",justifyContent:"center",marginTop:14},reportButtonText: {color: theme.onButton,fontWeight:"800",fontSize:14},reportForm: {marginTop:12},reportInput: {minHeight:100,borderWidth:1,borderColor: theme.border,borderRadius: theme.radius.control,padding:12,color: theme.foreground,fontSize:14,marginTop:8},characterCount: {fontSize:11,color: theme.muted,textAlign:"right",marginTop:5},reportActions: {flexDirection:"row",gap:10,marginTop:12},cancelButton: {flex:1,borderWidth:1,borderColor: theme.border,padding:12,borderRadius: theme.radius.control,alignItems:"center",justifyContent:"center"},cancelButtonText: {color: theme.foreground,fontWeight:"800"},disabledButton: {opacity:0.5},reportMessage: {marginTop:10,color: theme.error,fontSize:13,lineHeight:19}
});
