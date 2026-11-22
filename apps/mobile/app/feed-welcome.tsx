import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { GlassCard, Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { useNativeAccount } from "../src/native/useNativeAccount";

const messages: Record<string,string> = {
  player:"Share your journey, follow other players, and start a basketball discussion.",
  fan:"Follow your clubs and discover game-day conversations.",
  coach:"Introduce your coaching experience and help the basketball community grow.",
  agent:"Find talent and communicate professionally. Protect private information.",
  scout:"Find talent and discuss basketball opportunities respectfully.",
  manager:"Connect your club with basketball supporters.",
  club_admin:"Connect your club with basketball supporters.",
};
export default function FeedWelcome() {
  const theme=useEntryTheme();
  const router=useRouter();
  const {account}=useNativeAccount();
  const message=messages[account?.user.accountType||""] || "Find people who love basketball around the world.";
  return <SafeAreaView edges={["bottom","left","right"]} style={{flex:1,backgroundColor:theme.background}}>
    <ScrollView contentContainerStyle={{padding:18,gap:14,paddingBottom:38}}>
      <GlassCard><Text style={{color:theme.accent,fontSize:12,fontWeight:"900",letterSpacing:1.2}}>HOOPBOT · AUTOMATED GUIDE</Text>
        <Text accessibilityRole="header" style={{fontSize:30,fontWeight:"900",color:theme.foreground,marginVertical:10}}>Welcome to HoopFeed!</Text>
        <Text style={{color:theme.muted,lineHeight:22}}>I’m HoopBot, a built-in welcome guide, not a real person or live chat assistant.</Text>
        <Text style={{color:theme.foreground,lineHeight:23,marginTop:9}}>{message}</Text>
        <View style={{marginTop:15,gap:8}}><Button onPress={()=>router.push("/feed")}>Explore HoopFeed</Button><Button secondary onPress={()=>router.push("/account")}>Customize my profile</Button></View>
      </GlassCard>
      {[
        ["Discover basketball","Follow people, clubs, and leagues to shape your basketball community."],
        ["Share responsibly","Use Check, comments, replies, and media to support good basketball conversations. Membership rules still apply."],
        ["Find your group","Team Fan Groups belong to a club. HoopGroups are separate basketball servers with topic channels."],
        ["Keep it safe","Protect personal information, respect others, and report harmful content."],
      ].map(([title,description],index)=><GlassCard key={title}><Text style={{color:theme.foreground,fontWeight:"800",fontSize:18}}>{index+1}. {title}</Text><Text style={{color:theme.muted,marginTop:6,lineHeight:21}}>{description}</Text></GlassCard>)}
      <Button secondary onPress={()=>router.push("/team-hub/groups")}>Explore Team Fan Groups</Button>
      <Button secondary onPress={()=>router.push("/hoopgroups")}>Explore HoopGroups servers</Button>
    </ScrollView>
  </SafeAreaView>;
}
