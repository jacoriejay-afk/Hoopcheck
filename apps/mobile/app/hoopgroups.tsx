import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import HoopGroupsChannels from "../components/HoopGroupsChannels";
import { useEntryTheme } from "../src/theme";

const planned = [
  { name: "World Basketball", category: "Global community", detail: "Hoopers everywhere, every level." },
  { name: "Players Network", category: "Players", detail: "Career journeys and overseas experiences." },
  { name: "Coaches Corner", category: "Coaches", detail: "Development, tactics and training." },
  { name: "Scouting Room", category: "Agents & Scouts", detail: "Professional networking." },
  { name: "Women’s Hoops", category: "Women’s basketball", detail: "Independent women's basketball conversations." },
];

export default function HoopGroups() {
  const theme = useEntryTheme();
  const enabled = process.env.EXPO_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED === "true";
  return <SafeAreaView edges={["bottom","left","right"]} style={{flex:1,backgroundColor:theme.background}}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{
      paddingHorizontal:12,paddingTop:6,gap:9,paddingBottom:40,maxWidth:700,width:"100%",alignSelf:"center"}}>
      <Text accessibilityRole="header" style={{fontSize:22,fontFamily:"HoopCheckDisplay",color:theme.foreground}}>COMMUNITIES</Text>
      <Text style={{color:theme.muted,fontSize:13,lineHeight:20}}>
        Find your basketball people. Discover independent communities, create your own group, and join discussion channels.
      </Text>
      {enabled ? <HoopGroupsChannels /> : <>
        <View style={{paddingVertical:9,gap:7,borderTopWidth:1,borderColor:theme.glassBorder}}>
          <Text accessibilityRole="header" style={{color:theme.foreground,fontFamily:"HoopCheckDisplay",fontSize:18}}>
            Community spaces are preparing for launch
          </Text>
          <Text style={{color:theme.muted,fontSize:12,lineHeight:19}}>
            Group creation, member channels and moderated posting are not enabled in this release yet.
            These are upcoming independent communities, not club fan groups.
          </Text>
        </View>
        {planned.map(space=><View key={space.name}
          style={{borderBottomWidth:1,borderColor:theme.glassBorder,paddingVertical:10,gap:4}}>
          <Text style={{color:theme.accent,fontSize:10,fontWeight:"800",letterSpacing:.8}}>
            {space.category.toUpperCase()}
          </Text>
          <Text style={{color:theme.foreground,fontSize:16,fontWeight:"800"}}>{space.name}</Text>
          <Text style={{color:theme.muted,fontSize:12}}>{space.detail}</Text>
        </View>)}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
