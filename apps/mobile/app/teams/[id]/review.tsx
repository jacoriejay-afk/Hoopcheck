import { useHaptics } from "../../../src/native/haptics";
import { requireOnline, useNetwork } from "../../../src/native/network";
import { OfflineBanner } from "../../../components/OfflineBanner";
import { traceFlow } from "../../../src/native/telemetry";
import { useEntryTheme } from "../../../src/theme";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../src/lib/supabase";

const API_BASE_URL = process.env.EXPO_PUBLIC_HOOPCHECK_API_URL?.trim().replace(/\/+$/, "") ?? "";
const RATING_FIELDS = [
  { key: "overall_rating", label: "Overall experience" },
  { key: "communication_rating", label: "Communication" },
  { key: "professionalism_rating", label: "Professionalism" },
  { key: "development_rating", label: "Player development" },
  { key: "payment_rating", label: "Payment reliability" },
] as const;

export default function TeamReviewScreen() {
  const theme = useEntryTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const haptic = useHaptics();
  const { offline } = useNetwork();
  const params = useLocalSearchParams<{ id?: string | string[]; teamName?: string | string[] }>();
  const teamId = Array.isArray(params.id) ? params.id[0] : params.id;
  const teamName = Array.isArray(params.teamName) ? params.teamName[0] : params.teamName;
  const [ratings, setRatings] = useState<Record<string, number>>({
    overall_rating: 0, communication_rating: 0, professionalism_rating: 0, development_rating: 0, payment_rating: 0,
  });
  const [season, setSeason] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (error) haptic("error"); }, [error, haptic]);

  async function submitReview() {
    if (submitting) return;
    setError("");
    if (!teamId) { setError("This team could not be identified. Return to the team profile and try again."); return; }
    if (!API_BASE_URL) { setError("Review submission is not configured yet. Please use the HoopCheck website or try again later."); return; }
    if (RATING_FIELDS.some(field => ratings[field.key] < 1 || ratings[field.key] > 5)) {
      setError("Please choose a 1–5 rating for every category."); return;
    }
    if (!/^\d{4}(-\d{2,4})?$/.test(season.trim())) {
      setError("Enter the season you played for this team (for example, 2025-26)."); return;
    }
    if (body.trim().length < 10 || body.trim().length > 5000) {
      setError("Your review must be between 10 and 5,000 characters."); return;
    }
    if (title.trim().length > 120) { setError("The title must be 120 characters or fewer."); return; }

    setSubmitting(true);
    try {
      await requireOnline();
      const { data, error: sessionError } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (sessionError || !token) {
        setError("Your session has expired. Sign in again before submitting a review.");
        return;
      }
      const response = await traceFlow("posting", () => fetch(`${API_BASE_URL}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          team_id: teamId,
          player_season: season.trim(),
          title: title.trim(),
          body: body.trim(),
          is_anonymous: anonymous,
          ...ratings,
        }),
      }));
      const result = await response.json().catch(() => ({})) as { error?: string; id?: string; status?: string };
      if (!response.ok) {
        setError(result.error || "Your review could not be submitted. Please try again.");
        return;
      }
      haptic("reviewSubmitted");
      Alert.alert(
        "Review submitted",
        "Your review has been sent for moderation. It will not appear publicly unless approved.",
        [{ text: "Done", onPress: () => router.replace({ pathname: "/teams/[id]", params: { id: teamId } }) }],
      );
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes("offline") ? cause.message : "Could not connect to HoopCheck. Nothing was confirmed as sent. Your text stays here; reconnect and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <OfflineBanner savedAt={null} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back to team</Text></Pressable>
        <Text style={styles.kicker}>PLAYER EXPERIENCE</Text>
        <Text style={styles.heading}>Review {teamName || "this team"}</Text>
        <Text style={styles.subtitle}>Share a factual account of your experience to help players make informed decisions. Reviews are moderated before publication.</Text>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Who can submit?</Text>
          <Text style={styles.noticeText}>Submission requires a confirmed email, verified professional player profile, active HoopCheck membership, and a verified current or former affiliation with this team. The server checks these requirements.</Text>
        </View>
        <Text style={styles.label}>SEASON YOU PLAYED</Text>
        <TextInput value={season} onChangeText={setSeason} placeholder="e.g. 2025-26" placeholderTextColor={theme.muted} autoCapitalize="none" style={styles.input} maxLength={9} />
        {RATING_FIELDS.map(field => (
          <View key={field.key} style={styles.ratingGroup}>
            <Text style={styles.label}>{field.label.toUpperCase()}</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map(value => (
                <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${field.label}: ${value} out of 5`} accessibilityState={{ selected: ratings[field.key] === value }} onPress={() => setRatings(current => ({ ...current, [field.key]: value }))} style={[styles.starButton, ratings[field.key] >= value && styles.starSelected]}>
                  <Text style={[styles.starText, ratings[field.key] >= value && styles.starTextSelected]}>{value}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <Text style={styles.label}>TITLE (OPTIONAL)</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Summarize your experience" placeholderTextColor={theme.muted} style={styles.input} maxLength={120} />
        <Text style={styles.label}>YOUR REVIEW</Text>
        <TextInput value={body} onChangeText={setBody} placeholder="Describe your experience with specific, factual details. Avoid personal information and claims you cannot support." placeholderTextColor={theme.muted} style={[styles.input, styles.textArea]} multiline textAlignVertical="top" maxLength={5000} />
        <Text style={styles.charCount}>{body.length}/5000 characters (minimum 10)</Text>
        <View style={styles.anonymousRow}>
          <View style={styles.anonymousCopy}>
            <Text style={styles.anonymousTitle}>Submit anonymously</Text>
            <Text style={styles.anonymousHint}>Your public review will not display your name. HoopCheck still processes your account to verify eligibility and moderate submissions.</Text>
          </View>
          <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ false: "#C7D0DE", true: "#D69E18" }} />
        </View>
        {error ? <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        <Pressable accessibilityRole="button" disabled={submitting || offline} onPress={() => void submitReview()} style={[styles.submit, submitting && styles.disabled]}>
          {submitting ? <ActivityIndicator color={theme.foreground} /> : <Text style={styles.submitText}>{offline ? "Reconnect to submit · nothing sent" : "Submit for moderation"}</Text>}
        </Pressable>
        <Text style={styles.footer}>Do not include private contact details, threats, discriminatory language, or information about another person that they would reasonably expect to remain private.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useEntryTheme>) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  content: { padding: 22, paddingBottom: 38 },
  back: { color: theme.accent, fontSize: 15, fontWeight: "800", marginBottom: 24 },
  kicker: { color: theme.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  heading: { color: theme.foreground, fontSize: 28, fontWeight: "900", marginTop: 8 },
  subtitle: { color: theme.muted, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 18 },
  notice: { backgroundColor: theme.accentSurface, borderColor: theme.border, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 22 },
  noticeTitle: { color: theme.foreground, fontWeight: "900", fontSize: 14 },
  noticeText: { color: theme.foreground, fontSize: 13, lineHeight: 19, marginTop: 5 },
  label: { color: theme.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8 },
  input: { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 10, minHeight: 48, paddingHorizontal: 13, paddingVertical: 12, color: theme.foreground, fontSize: 15, marginBottom: 18 },
  ratingGroup: { marginBottom: 20 },
  stars: { flexDirection: "row", gap: 9 },
  starButton: { width: 43, height: 43, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  starSelected: { backgroundColor: theme.background, borderColor: theme.border },
  starText: { color: theme.muted, fontSize: 15, fontWeight: "800" },
  starTextSelected: { color: theme.accent },
  textArea: { minHeight: 150, paddingTop: 13 },
  charCount: { color: theme.muted, fontSize: 12, textAlign: "right", marginTop: -10, marginBottom: 18 },
  anonymousRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16 },
  anonymousCopy: { flex: 1 },
  anonymousTitle: { color: theme.foreground, fontSize: 14, fontWeight: "800" },
  anonymousHint: { color: theme.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  errorBox: { backgroundColor: theme.errorSurface, borderRadius: 10, padding: 12, marginBottom: 14 },
  errorText: { color: theme.error, fontSize: 13, lineHeight: 19 },
  submit: { minHeight: 52, borderRadius: 10, backgroundColor: theme.button, alignItems: "center", justifyContent: "center" },
  submitText: { color: theme.onButton, fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.65 },
  footer: { color: theme.muted, fontSize: 12, lineHeight: 18, marginTop: 18 },
});
