import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const plans = [
  {
    name: "Pro",
    price: "$4.99",
    description: "Monthly membership",
    features: ["HoopCheck Pro access", "Membership benefits tied to your account"],
  },
  {
    name: "Premium",
    price: "$9.99",
    description: "Monthly membership",
    features: ["HoopCheck Premium access", "Premium membership benefits"],
  },
] as const;

export default function MembershipScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>HOOPCHECK MEMBERSHIP</Text>
        <Text style={styles.title}>Choose your level.</Text>
        <Text style={styles.subtitle}>
          These are the current monthly membership prices. Your access is only
          upgraded after a billing provider confirms an active subscription.
        </Text>

        {plans.map((plan) => (
          <View key={plan.name} style={styles.plan}>
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDescription}>{plan.description}</Text>
              </View>
              <Text style={styles.price}>{plan.price}<Text style={styles.per}> / month</Text></Text>
            </View>
            {plan.features.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Text style={styles.check}>✓</Text>
                <Text style={styles.feature}>{feature}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Apple billing is being prepared</Text>
          <Text style={styles.noticeText}>
            Purchase and Restore Purchases are not enabled yet. StoreKit,
            Apple transaction verification, and subscription reconciliation
            must be completed before this app can safely accept purchases.
          </Text>
        </View>
        <Text style={styles.footer}>
          If you already subscribe on the web, your existing Stripe membership
          must remain separate and continue to be honored. This screen does
          not change or cancel any subscription.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050505" },
  container: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36 },
  eyebrow: { color: "#FF6A00", fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: "#FFFFFF", fontSize: 30, fontWeight: "900", marginTop: 10 },
  subtitle: { color: "#BDBDBD", fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 22 },
  plan: { backgroundColor: "#111111", borderColor: "#303030", borderWidth: 1, borderRadius: 14, padding: 18, marginBottom: 12 },
  planHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  planName: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  planDescription: { color: "#969696", fontSize: 12, marginTop: 4 },
  price: { color: "#FF6A00", fontSize: 22, fontWeight: "900" },
  per: { color: "#BDBDBD", fontSize: 11, fontWeight: "600" },
  featureRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 8, gap: 9 },
  check: { color: "#FF6A00", fontSize: 15, fontWeight: "900" },
  feature: { flex: 1, color: "#D0D0D0", fontSize: 13, lineHeight: 19 },
  notice: { borderWidth: 1, borderColor: "#604020", backgroundColor: "#1A120D", borderRadius: 12, padding: 16, marginTop: 10 },
  noticeTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  noticeText: { color: "#D0C2B8", fontSize: 13, lineHeight: 20, marginTop: 8 },
  footer: { color: "#858585", fontSize: 12, lineHeight: 18, marginTop: 18 },
});
