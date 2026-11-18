import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEntryTheme } from "../src/theme";

export default function AlertsScreen() {
  const theme = useEntryTheme();
  async function openAlerts() {
    try { await Linking.openURL("https://hoopcheck.online/notifications"); }
    catch { Alert.alert("Unable to open alerts", "Visit hoopcheck.online/notifications to continue."); }
  }
  return <SafeAreaView edges={["left", "right"]} style={[styles.safe, { backgroundColor: theme.background }]}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.foreground }]}>Alerts</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="notifications-outline" size={32} color={theme.accent} />
        <Text style={[styles.title, { color: theme.foreground }]}>Your notifications</Text>
        <Text style={[styles.description, { color: theme.muted }]}>View your account notifications on HoopCheck. Native notifications will be added after secure delivery and read-state syncing are verified.</Text>
        <Pressable accessibilityRole="link" onPress={() => void openAlerts()} style={[styles.button, { backgroundColor: theme.button }]}>
          <Text style={{ color: theme.onButton, fontWeight: "800" }}>Open notifications ↗</Text>
        </Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 20, paddingBottom: 32 },
  heading: { fontFamily: "HoopCheckDisplay", fontSize: 32 },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 12, marginTop: 22 },
  title: { fontSize: 20, fontWeight: "800" },
  description: { fontSize: 14, lineHeight: 21 },
  button: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 10 },
});