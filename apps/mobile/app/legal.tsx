import { ScrollView, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { legalDocuments, type LegalDocument } from "../src/native/legalDocuments";

export default function LegalScreen() {
  const { document } = useLocalSearchParams<{ document?: string }>();
  const router = useRouter(), t = useEntryTheme();
  const key = typeof document === "string" && Object.prototype.hasOwnProperty.call(legalDocuments, document) ? document as LegalDocument : "privacy";
  const policy = legalDocuments[key];
  return <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 12 }}>
    <Text accessibilityRole="header" style={{ fontFamily: "HoopCheckDisplay", color: t.foreground, fontSize: 28 }}>{policy.title}</Text>
    {policy.content.map((entry, i) => <Text key={i} accessibilityRole={entry.kind === "h2" ? "header" : undefined} style={{ color: t.foreground, fontSize: entry.kind === "h2" ? 19 : 16, lineHeight: entry.kind === "h2" ? 26 : 24, fontWeight: entry.kind === "h2" ? "700" : "400" }}>{entry.kind === "li" ? "• " : ""}{entry.text}</Text>)}
    {(Object.keys(legalDocuments) as LegalDocument[]).filter(other => other !== key).map(other => <Button key={other} secondary onPress={() => router.replace({ pathname: "/legal", params: { document: other } })}>{legalDocuments[other].title}</Button>)}
    <Button secondary onPress={() => router.push("/account/support")}>Help & Support</Button>
    {key === "privacy" ? <Button secondary onPress={() => router.push("/account/privacy-center")}>Privacy Request Center</Button> : null}
    {key === "terms" ? <Button secondary onPress={() => router.push({ pathname: "/web", params: { path: "/copyright" } })}>Copyright reporting (website)</Button> : null}
    <Button secondary onPress={() => router.canGoBack() ? router.back() : router.replace("/")}>Back</Button>
  </ScrollView>;
}
