import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Button, GlassCard } from "../src/primitives";
import HoopGroupsChannels from "../components/HoopGroupsChannels";
import { useEntryTheme } from "../src/theme";

const spaces = [
  { name: "World Basketball", category: "Global basketball", description: "Leagues, teams, and cross-country conversations." },
  { name: "Players Network", category: "Players", description: "Players sharing basketball experiences." },
  { name: "Fans Courtside", category: "Fans", description: "Supporters from around the world." },
  { name: "Coaches Corner", category: "Coaches", description: "Development, drills, and coaching discussions." },
  { name: "Scouting Room", category: "Agents & Scouts", description: "Professional basketball networking." },
  { name: "Women's Hoops", category: "Women's basketball", description: "Women's leagues, clubs, and community." },
];

export default function HoopGroups() {
  const theme=useEntryTheme();
  const router=useRouter();
  return <SafeAreaView edges={["bottom","left","right"]} style={{flex:1,backgroundColor:theme.background}}>
    <ScrollView contentContainerStyle={{padding:16,gap:12,paddingBottom:40}}>
      <Text accessibilityRole="header" style={{fontSize:29,fontWeight:"900",color:theme.foreground}}>HoopGroups</Text>
      <Text style={{color:theme.muted,lineHeight:22}}>Topic-based basketball servers and channels, separate from each club’s Team Fan Group.</Text>
      {process.env.EXPO_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED === "true" ? <HoopGroupsChannels /> : <>
      <GlassCard><Text style={{color:theme.foreground,fontWeight:"800",fontSize:18}}>Community server preview</Text>
        <Text style={{color:theme.muted,marginTop:8}}>These are planned dedicated communities. Channels are not live until the backend and moderation release is approved.</Text>
        <Button secondary onPress={()=>router.push("/team-hub/groups")}>Browse official Team Fan Groups</Button>
      </GlassCard>
      {spaces.map(space=><GlassCard key={space.name}>
        <Text style={{color:theme.accent,fontWeight:"800",fontSize:12}}>{space.category.toUpperCase()}</Text>
        <Text style={{color:theme.foreground,fontSize:19,fontWeight:"800",marginTop:5}}>{space.name}</Text>
        <Text style={{color:theme.muted,marginTop:5}}>{space.description}</Text>
        <View style={{flexDirection:"row",gap:6,flexWrap:"wrap",marginTop:8}}>{["#welcome","#general","#game-talk"].map(channel=><Text key={channel} style={{fontSize:12,color:theme.foreground,backgroundColor:theme.chip,borderRadius:12,padding:7}}>{channel}</Text>)}</View>
      </GlassCard>)}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
