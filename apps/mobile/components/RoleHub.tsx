import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useNativeAccount } from "../src/native/useNativeAccount";
import { useEntryTheme } from "../src/theme";

type Destination = "/account" | "/teams" | "/players" | "/fan-live" | "/messages" |
  "/feed" | "/leagues" | "/team-hub/groups" | "/hoopgroups";
type Shortcut = { label: string; href: Destination; icon: "person-outline" | "basketball-outline" |
  "chatbubble-ellipses-outline" | "people-outline" | "flash-outline" | "search-outline" };
const map: Record<string, { heading: string; links: Shortcut[] }> = {
  player: { heading: "PLAYER HQ", links: [
    { label: "My profile", href: "/account", icon: "person-outline" },
    { label: "Research clubs", href: "/teams", icon: "search-outline" },
    { label: "HoopChat", href: "/messages", icon: "chatbubble-ellipses-outline" }] },
  fan: { heading: "FAN HQ", links: [
    { label: "Live games", href: "/fan-live", icon: "flash-outline" },
    { label: "My club groups", href: "/team-hub/groups", icon: "people-outline" },
    { label: "Teams", href: "/teams", icon: "basketball-outline" }] },
  coach: { heading: "COACH HQ", links: [
    { label: "Discover players", href: "/players", icon: "person-outline" },
    { label: "Clubs", href: "/teams", icon: "basketball-outline" },
    { label: "HoopChat", href: "/messages", icon: "chatbubble-ellipses-outline" }] },
  agent: { heading: "AGENT HQ", links: [
    { label: "Find talent", href: "/players", icon: "search-outline" },
    { label: "Leagues", href: "/leagues", icon: "basketball-outline" },
    { label: "HoopChat", href: "/messages", icon: "chatbubble-ellipses-outline" }] },
  scout: { heading: "SCOUT HQ", links: [
    { label: "Find talent", href: "/players", icon: "search-outline" },
    { label: "Leagues", href: "/leagues", icon: "basketball-outline" },
    { label: "HoopChat", href: "/messages", icon: "chatbubble-ellipses-outline" }] },
  manager: { heading: "TEAM HQ", links: [
    { label: "My clubs", href: "/teams", icon: "basketball-outline" },
    { label: "Manage club fans", href: "/team-hub/groups", icon: "people-outline" },
    { label: "Messages", href: "/messages", icon: "chatbubble-ellipses-outline" }] },
};
map.club_admin = map.manager;

/** Navigation only. Every destination enforces its own backend membership/role access. */
export function RoleHub() {
  const theme = useEntryTheme();
  const router = useRouter();
  const { account } = useNativeAccount();
  const workspace = account ? map[account.user.accountType] : null;
  if (!workspace) return null; // Never infer a role from unverified auth metadata.
  return <View style={{gap:8,marginVertical:10}}>
    <View style={{flexDirection:"row",alignItems:"center",gap:7}}>
      <View style={{width:3,height:20,borderRadius:2,backgroundColor:"#FF7B36"}}/>
      <Text accessibilityRole="header" style={{color:theme.foreground,
        fontFamily:"HoopCheckDisplay",fontSize:19,lineHeight:23}}>{workspace.heading}</Text>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>
      {workspace.links.map(item=><Pressable key={item.href} accessibilityRole="link"
        accessibilityLabel={item.label} onPress={()=>router.push(item.href)}
        style={({pressed})=>({minHeight:44,paddingHorizontal:12,paddingVertical:8,borderRadius:13,
          borderWidth:1,borderColor:theme.dark?"rgba(255,133,65,.40)":theme.border,
          backgroundColor:theme.elevatedSurface,flexDirection:"row",alignItems:"center",
          gap:6,opacity:pressed?.72:1})}>
        <Ionicons name={item.icon} size={17} color={theme.accent}/>
        <Text style={{color:theme.foreground,fontFamily:theme.type.ui.fontFamily,
          fontWeight:"700",fontSize:12}}>{item.label}</Text>
      </Pressable>)}
    </ScrollView>
  </View>;
}
