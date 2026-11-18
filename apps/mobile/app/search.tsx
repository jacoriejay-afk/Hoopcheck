import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEntryTheme } from "../src/theme";

const categories = [
  { route: "/players", title: "Players", description: "Search professional player usernames", icon: "people-outline" },
  { route: "/teams", title: "Teams", description: "Find clubs by team, city, country, or league", icon: "basketball-outline" },
  { route: "/leagues", title: "Leagues", description: "Browse basketball leagues", icon: "trophy-outline" },
  { route: "/coaches", title: "Coaches", description: "Discover professional coaches", icon: "school-outline" },
] as const;

export default function SearchScreen() {
  const theme = useEntryTheme();
  const router = useRouter();
  return (
    <SafeAreaView edges={["left", "right"]} style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.foreground }]}>Search HoopCheck</Text>
        <Text style={[styles.description, { color: theme.muted }]}>Choose what you want to explore.</Text>
        <View style={styles.list}>
          {categories.map(category => (
            <Pressable key={category.route} accessibilityRole="link" onPress={() => router.push(category.route)}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.accentSurface : theme.surface, borderColor: theme.border }]}>
              <View style={[styles.icon, { backgroundColor: theme.accentSurface }]}>
                <Ionicons name={category.icon} size={22} color={theme.accent} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.title, { color: theme.foreground }]}>{category.title}</Text>
                <Text style={[styles.detail, { color: theme.muted }]}>{category.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.accent} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  heading: { fontSize: 29, fontFamily: "HoopCheckDisplay", marginTop: 8 },
  description: { fontSize: 14, marginTop: 6 },
  list: { gap: 10, marginTop: 22 },
  row: { minHeight: 72, borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  copy: { flex: 1 },
  title: { fontSize: 16, fontWeight: "800" },
  detail: { fontSize: 12, marginTop: 3, lineHeight: 17 },
});
