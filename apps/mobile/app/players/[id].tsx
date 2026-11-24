import { OwnAffiliations } from "../../components/OwnAffiliations";
import { PlayerCareer } from "../../components/PlayerCareer";
import { PlayerPassport } from "../../components/PlayerPassport";
import { PlayerAccess } from "../../components/PlayerAccess";
import { ProfileAvatar } from "../../components/ProfileAvatar";
import { readPlayerProfile, type PlayerProfile, type PlayerViewer } from "../../src/native/playerProfiles";
import { GlassCard, Button, Chip } from "../../src/primitives";
import { Ionicons } from "@expo/vector-icons";
import { ShareSheet } from "../../components/ShareSheet";
import { Sheet } from "../../components/Sheet";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { useHaptics } from "../../src/native/haptics";
import { useNetwork, requireOnline } from "../../src/native/network";
import { Skeleton } from "../../components/Motion";
import { useEntryTheme, type EntryTheme } from "../../src/theme";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";

export default function PlayerDetailScreen() { return <PlayerAccess>{viewer => <PlayerProfileDetails viewer={viewer} />}</PlayerAccess>; }

function PlayerProfileDetails({ viewer }: { viewer: PlayerViewer }) {
  const theme = useEntryTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);
  const compactHero = useWindowDimensions().width < 390;
  const { id: viewerId, accountType } = viewer;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const haptic = useHaptics();
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
      setLoading(true); setError(""); setPlayer(null);
      try {
        const result = await readPlayerProfile(supabase, { id: viewerId, accountType }, id);
        if (!active) return;
        setPlayer(result);
        if (!result) setError("This profile is unavailable for your account.");
      } catch {
        if (active) { setPlayer(null); setError("This profile could not be verified. Reconnect and try again."); }
      }
      if (!active) return;
      setLoading(false);
      setRefreshing(false);
    }
    if (id) void load(); else { setError("This profile link is invalid."); setLoading(false); }
    return () => { active = false; };
  }, [id, revision, refreshId, offline, viewerId, accountType]);

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

  const name = player?.display_name || ("Player profile");
  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <ScrollView keyboardDismissMode="on-drag" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setRefreshId(value => value + 1); }} />} contentContainerStyle={[styles.content, { paddingTop: insets.top + 62, paddingBottom: 100 }]} keyboardShouldPersistTaps="handled">
        {loading ? <Skeleton profile /> : error ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>Profile unavailable</Text><Text style={styles.body}>{error}</Text><Button secondary onPress={() => setRefreshId(v => v + 1)}>Retry profile</Button>{id === viewerId ? <Button onPress={() => router.push("/account/edit")}>Edit my profile</Button> : <Button style={styles.button} onPress={() => router.replace("/players")}><Text style={styles.buttonText}>Return to player search</Text></Button>}</View>
        ) : player ? (
          <>
            <GlassCard style={styles.hero}>
              <View style={{ width: "100%", gap: 10, paddingVertical: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
                  <ProfileAvatar url={player.avatar_url} name={name} size={compactHero ? 72 : 92} />
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text accessibilityRole="header" numberOfLines={2} style={{ fontFamily: "HoopCheckDisplay", fontSize: compactHero ? 25 : 30, color: theme.foreground }}>{name}</Text>
                    <Text style={{ color: theme.muted, fontSize: 13 }}>Professional player</Text>
                    {player.player_verified ? <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}><Ionicons name="checkmark-circle" size={16} color={theme.success} /><Text style={{ color: theme.success, fontSize: 12, fontWeight: "700" }}>VERIFIED</Text></View> : null}
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginVertical: theme.spacing.sm }}>
                 {player.position ? <Chip>{player.position}</Chip> : null}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md, paddingVertical: theme.spacing.sm, borderTopWidth: 1, borderColor: theme.border, width: "100%" }}>
                {[{ label: "PRO EXPERIENCE", value: player.years_pro === null ? "Not listed" : `${player.years_pro} ${player.years_pro === 1 ? "year" : "years"}` }, { label: "CURRENT TEAM", value: player.current_team || "Not listed" }].map(item => <View key={item.label} style={{ flexShrink: 1, gap: theme.spacing.xs }}><Text style={{ ...theme.type.caption, color: theme.muted }}>{item.label}</Text><Text selectable style={{ ...theme.type.section, color: theme.foreground }}>{item.value}</Text></View>)}
              </View>
              <ShareSheet title={name} path={`/players/${player.id}`} />
              <PlayerPassport player={player} />
              {player.player_verified ? <Text style={{ color: theme.success, marginTop: 8 }}>Verified professional player</Text> : null}
            </GlassCard>
            <GlassCard style={styles.card}>
              <Text style={styles.sectionTitle}>Player details</Text>
              <Info label="Current team" value={player.current_team} />
              <Info label="Current country" value={player.current_country} />
              <Info label="Position" value={player.position} />
              <Info label="Professional experience" value={player.years_pro === null ? null : `${player.years_pro} ${player.years_pro === 1 ? "year" : "years"}`} />
              <Info label="Country" value={player.country} />
            </GlassCard>
            {player.bio?.trim() ? <GlassCard style={styles.card}><Text style={styles.sectionTitle}>About</Text><Text style={styles.body}>{player.bio.trim()}</Text></GlassCard> : null}

            <GlassCard style={styles.card}><Text style={styles.sectionTitle}>Achievements &amp; verification</Text>
              <Text style={{ ...theme.type.section, color: player.player_verified ? theme.success : theme.foreground }}>{player.player_verified ? "Professional player verified" : "Professional verification not recorded"}</Text>
              {player.player_verified_at ? <Text style={styles.body}>Verified {new Date(player.player_verified_at).toLocaleDateString()}</Text> : null}
              <Text style={styles.body}>Verification reflects your HoopCheck profile. Playing awards and performance records are not supplied by this profile.</Text>
            </GlassCard>
            <OwnAffiliations key={`${viewerId}:${player.id}`} profileId={player.id} />
            <PlayerCareer key={`${viewerId}:${player.id}`} playerId={player.id} viewer={viewer} />
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
            <Text style={styles.footer}>Public profile fields follow the player’s privacy and moderation settings. Verified team links are visible only to their owner here. Verify roster and free-agent status independently.</Text>
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
  safe: {flex:1,backgroundColor: theme.background},content: {padding:12,paddingBottom:24,width:"100%",maxWidth:720,alignSelf:"center"},back: {color: theme.accent,fontSize:14,fontWeight:"700",marginBottom:8},hero: {backgroundColor: "transparent",borderWidth:0,borderRadius:0,padding:0,alignItems:"flex-start",marginBottom:10},avatar: {width:60,height:60,borderRadius:18,backgroundColor: theme.chip,alignItems:"center",justifyContent:"center",marginBottom:15},avatarText: {fontSize:26,fontWeight:"900",color: theme.onChip},kicker: {fontSize:10,fontWeight:"900",letterSpacing:1.4,color: theme.accent},heroTitle: {fontSize:36,lineHeight:40,fontWeight: "400", fontFamily: "HoopCheckDisplay",color: theme.foreground,marginTop:5},emptyTitle: {fontSize:22,fontWeight:"900",color: theme.foreground,textAlign:"center"},handle: {color: theme.muted,fontSize:14,marginTop:4},pill: {backgroundColor: theme.chip,borderRadius:20,paddingHorizontal:10,paddingVertical:5,marginTop:12},pillText: {color: theme.onChip,fontSize:10,fontWeight:"900",letterSpacing:0.7},card: {backgroundColor: "transparent",borderRadius:0,padding:8,marginBottom:6,borderWidth:0,borderBottomWidth:1,borderColor: theme.border},sectionTitle: {fontSize:15,fontWeight:"700",fontFamily:theme.type.ui.fontFamily,color: theme.foreground,marginBottom:8},infoRow: {paddingVertical:9,borderBottomWidth:1,borderBottomColor: theme.border,gap:4},label: {fontSize:11,fontWeight:"800",color: theme.muted,textTransform:"uppercase",letterSpacing:0.5},value: {fontSize:15,color: theme.foreground,fontWeight:"600"},body: {fontSize:14,lineHeight:21,color: theme.muted},footer: {fontSize:12,lineHeight:18,color: theme.muted,textAlign:"center",paddingHorizontal:4,marginTop:4},loader: {marginTop:60},empty: {backgroundColor: theme.surface,padding:22,borderRadius: theme.radius.card,alignItems:"center"},button: {backgroundColor: theme.button,padding:13,borderRadius: theme.radius.control,marginTop:16},buttonText: {color: theme.onButton,fontWeight:"900"},reportCard: {backgroundColor: theme.surface,borderRadius: theme.radius.card,padding:12,marginBottom:8,borderWidth:1,borderColor: theme.border},reportButton: {backgroundColor: theme.button,paddingHorizontal:14,paddingVertical:12,borderRadius: theme.radius.control,alignItems:"center",justifyContent:"center",marginTop:14},reportButtonText: {color: theme.onButton,fontWeight:"800",fontSize:14},reportForm: {marginTop:12},reportInput: {minHeight:100,borderWidth:1,borderColor: theme.border,borderRadius: theme.radius.control,padding:12,color: theme.foreground,fontSize:14,marginTop:8},characterCount: {fontSize:11,color: theme.muted,textAlign:"right",marginTop:5},reportActions: {flexDirection:"row",gap:10,marginTop:12},cancelButton: {flex:1,borderWidth:1,borderColor: theme.border,padding:12,borderRadius: theme.radius.control,alignItems:"center",justifyContent:"center"},cancelButtonText: {color: theme.foreground,fontWeight:"800"},disabledButton: {opacity:0.5},reportMessage: {marginTop:10,color: theme.error,fontSize:13,lineHeight:19}
});
