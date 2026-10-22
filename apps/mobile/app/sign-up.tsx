import { useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase, supabaseConfigurationError } from "../src/lib/supabase";

const TERMS_VERSION = "2026-10-01";
const ACCOUNT_TYPES = [
  { value: "player", label: "Player" },
  { value: "coach", label: "Coach" },
  { value: "scout", label: "Scout" },
  { value: "agent", label: "Agent" },
  { value: "fan", label: "Fan" },
] as const;
const LEGAL_BASE = "https://hoopcheck-hoopcheck.vercel.app";

function validBirthdate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function ageAtDate(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  return age;
}

export default function SignUpScreen() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<(typeof ACCOUNT_TYPES)[number]["value"]>("player");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function createAccount() {
    setErrorMessage("");
    if (supabaseConfigurationError) { setErrorMessage(supabaseConfigurationError); return; }
    if (firstName.trim().length < 2 || lastName.trim().length < 2) { setErrorMessage("Enter your first and last name."); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) { setErrorMessage("Username must be 3–20 characters using letters, numbers, or underscores."); return; }
    if (!validBirthdate(birthdate)) { setErrorMessage("Enter a valid birthdate in YYYY-MM-DD format."); return; }
    if (ageAtDate(birthdate) < 18) { setErrorMessage("You must be 18 or older to create a HoopCheck account."); return; }
    if (!["male", "female", "non_binary", "prefer_not_to_say"].includes(gender)) { setErrorMessage("Select a gender option."); return; }
    if (accountType === "player" && !["PG", "SG", "SF", "PF", "C"].includes(position)) { setErrorMessage("Select your primary basketball position."); return; }
    if (password.length < 6) { setErrorMessage("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setErrorMessage("Passwords do not match."); return; }
    if (!accepted) { setErrorMessage("Please agree to the Terms of Service and acknowledge the Privacy Policy and Community Guidelines."); return; }

    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: {
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          account_type: accountType,
          username: username.trim().toLowerCase(),
          basketball_type: accountType === "player" && gender === "female" ? "womens" : accountType === "player" ? "mens" : null,
          position: accountType === "player" ? position : null,
          years_pro: accountType === "player" ? 0 : null,
          professional_experience: false,
          former_team_ids: [],
          favorite_teams: "",
          is_adult: true,
          birthdate,
          gender,
          agreed_to_terms: true,
          terms_accepted_at: new Date().toISOString(),
          terms_version: TERMS_VERSION,
        } },
      });
      if (error) throw error;
      if (data.session) {
        router.replace("/dashboard");
      } else {
        Alert.alert("Check your email", "HoopCheck may require email verification before you can sign in.", [
          { text: "Go to sign in", onPress: () => router.replace("/sign-in") },
        ]);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create the account. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Join the basketball community. You must be 18 or older.</Text>

          <Text style={styles.label}>Account type</Text>
          <View style={styles.choices}>
            {ACCOUNT_TYPES.map((item) => (
              <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ selected: accountType === item.value }} onPress={() => setAccountType(item.value)} style={[styles.choice, accountType === item.value && styles.choiceSelected]}>
                <Text style={[styles.choiceText, accountType === item.value && styles.choiceTextSelected]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>First name</Text>
          <TextInput value={firstName} onChangeText={setFirstName} autoComplete="given-name" style={styles.input} placeholder="First name" />
          <Text style={styles.label}>Last name</Text>
          <TextInput value={lastName} onChangeText={setLastName} autoComplete="family-name" style={styles.input} placeholder="Last name" />
          <Text style={styles.label}>Username</Text>
          <TextInput value={username} onChangeText={(v) => setUsername(v.replace(/\s+/g, "").toLowerCase())} autoCapitalize="none" autoComplete="username" style={styles.input} placeholder="3–20 letters, numbers or underscores" />
          <Text style={styles.label}>Birthdate (YYYY-MM-DD)</Text>
          <TextInput value={birthdate} onChangeText={setBirthdate} keyboardType="numbers-and-punctuation" placeholder="1990-04-23" style={styles.input} maxLength={10} />
          <Text style={styles.hint}>Your birthdate is used to enforce HoopCheck’s 18+ account requirement.</Text>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.genderChoices}>
            {[
              ["male", "Male"], ["female", "Female"], ["non_binary", "Non-binary"], ["prefer_not_to_say", "Prefer not to say"],
            ].map(([value, label]) => (
              <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: gender === value }} onPress={() => setGender(value)} style={[styles.choice, gender === value && styles.choiceSelected]}>
                <Text style={[styles.choiceText, gender === value && styles.choiceTextSelected]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {accountType === "player" ? (
            <>
              <Text style={styles.label}>Primary basketball position</Text>
              <View style={styles.choices}>
                {[["PG", "Point guard"], ["SG", "Shooting guard"], ["SF", "Small forward"], ["PF", "Power forward"], ["C", "Center"]].map(([value, label]) => (
                  <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: position === value }} onPress={() => setPosition(value)} style={[styles.choice, position === value && styles.choiceSelected]}>
                    <Text style={[styles.choiceText, position === value && styles.choiceTextSelected]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" style={styles.input} placeholder="you@example.com" />
          <Text style={styles.label}>Password</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" style={styles.input} placeholder="At least 6 characters" />
          <Text style={styles.label}>Confirm password</Text>
          <TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" style={styles.input} placeholder="Enter password again" />

          <Pressable onPress={() => setAccepted(!accepted)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} style={styles.consent}>
            <View style={[styles.checkbox, accepted && styles.checkboxChecked]}><Text style={styles.checkmark}>{accepted ? "✓" : ""}</Text></View>
            <Text style={styles.consentText}>I agree to the Terms of Service and acknowledge the Privacy Policy and Community Guidelines.</Text>
          </Pressable>
          <View style={styles.legalLinks}>
            <Text onPress={() => Linking.openURL(`${LEGAL_BASE}/terms`)} style={styles.link}>Terms of Service</Text>
            <Text onPress={() => Linking.openURL(`${LEGAL_BASE}/privacy`)} style={styles.link}>Privacy Policy</Text>
            <Text onPress={() => Linking.openURL(`${LEGAL_BASE}/community-guidelines`)} style={styles.link}>Community Guidelines</Text>
          </View>
          {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
          <Pressable onPress={createAccount} disabled={busy} style={[styles.button, busy && styles.dim]}><Text style={styles.buttonText}>{busy ? "Creating account…" : "Create account"}</Text></Pressable>
          <Text style={styles.bottomText}>Already have an account? <Link href="/sign-in" style={styles.link}>Sign in</Link></Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050505" }, flex: { flex: 1 },
  container: { padding: 22, paddingBottom: 36 },
  title: { fontSize: 28, fontWeight: "800", color: "#FFFFFF" },
  subtitle: { color: "#BDBDBD", fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 18 },
  label: { color: "#253247", fontWeight: "700", marginTop: 15, marginBottom: 7 },
  input: { minHeight: 48, borderColor: "#D5DCE5", borderWidth: 1, borderRadius: 10, backgroundColor: "#111111", paddingHorizontal: 13, color: "#FFFFFF", fontSize: 16 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genderChoices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { borderWidth: 1, borderColor: "#D5DCE5", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#111111" },
  choiceSelected: { borderColor: "#101827", backgroundColor: "#050505" },
  choiceText: { color: "#263247", fontWeight: "600" }, choiceTextSelected: { color: "#FFFFFF" },
  hint: { color: "#969696", fontSize: 12, lineHeight: 17, marginTop: 5 },
  consent: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 20 },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: "#778397", borderRadius: 5, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: "#050505", borderColor: "#101827" },
  checkmark: { color: "#FFFFFF", fontWeight: "800" },
  consentText: { flex: 1, color: "#37465C", fontSize: 13, lineHeight: 19 },
  legalLinks: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 },
  link: { color: "#263B59", fontWeight: "700" },
  error: { color: "#B42318", backgroundColor: "#FEE4E2", padding: 12, borderRadius: 8, marginTop: 14, lineHeight: 20 },
  button: { minHeight: 52, borderRadius: 10, backgroundColor: "#050505", alignItems: "center", justifyContent: "center", marginTop: 22 },
  dim: { opacity: 0.65 }, buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
  bottomText: { color: "#BDBDBD", textAlign: "center", marginTop: 22 },
});
