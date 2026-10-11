import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";

type PlayerProfile = {
  id: string; display_name: string | null; username: string | null; country: string | null;
  current_country: string | null; current_team: string | null; position: string | null;
  years_pro: number | null; free_agent: boolean; bio: string | null; hometown: string | null;
  nationality: string | null; experience_summary: string | null;
};

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      const { data, error: queryError } = await supabase.from("profiles")
        .select("id,display_name,username,country,current_country,current_team,position,years_pro,free_agent,bio,hometown,nationality,experience_summary")
        .eq("id", id)
        .eq("account_type", "player")
        .eq("profile_visibility", "public")
        .eq("moderation_status", "normal")
        .eq("basketball_type", "mens")
        .eq("professional_experience", true)
        .maybeSingle();
      if (!active) return;
      if (queryError || !data) {
        setError("This profile is unavailable or is no longer public.");
        setPlayer(null);
      } else {
        setPlayer(data as PlayerProfile);
      }
      setLoading(false);
    }
    if (id) void load(); else { setError("This profile link is invalid."); setLoading(false); }
    return () => { active = false; };
  }, [id]);

  const name = player?.display_name || (player?.username ? `@${player.username}` : "Player profile");
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back to players</Text></Pressable>
        {loading ? <ActivityIndicator style={styles.loader} size="large" color="#D69E18" /> : error ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>Profile unavailable</Text><Text style={styles.body}>{error}</Text><Pressable style={styles.button} onPress={() => router.replace("/players")}><Text style={styles.buttonText}>Return to player search</Text></Pressable></View>
        ) : player ? (
          <>
            <View style={styles.hero}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{name.slice(0,1).toUpperCase()}</Text></View>
              <Text style={styles.kicker}>PUBLIC PLAYER PROFILE</Text>
              <Text style={styles.heroTitle}>{name}</Text>
              {player.username && player.display_name ? <Text style={styles.handle}>@{player.username}</Text> : null}
              {player.free_agent ? <View style={styles.pill}><Text style={styles.pillText}>FREE AGENT</Text></View> : null}
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Player details</Text>
              <Info label="Current team" value={player.current_team} />
              <Info label="Current country" value={player.current_country || player.country} />
              <Info label="Position" value={player.position} />
              <Info label="Professional experience" value={player.years_pro === null ? null : `${player.years_pro} ${player.years_pro === 1 ? "year" : "years"}`} />
              <Info label="Nationality" value={player.nationality} />
              <Info label="Hometown" value={player.hometown} />
            </View>
            {player.bio?.trim() ? <View style={styles.card}><Text style={styles.sectionTitle}>About</Text><Text style={styles.body}>{player.bio.trim()}</Text></View> : null}
            {player.experience_summary?.trim() ? <View style={styles.card}><Text style={styles.sectionTitle}>Experience</Text><Text style={styles.body}>{player.experience_summary.trim()}</Text></View> : null}
            <Text style={styles.footer}>Only fields intended for public profile display are shown. Profile availability follows the player’s privacy and moderation settings. Verify roster and free-agent status independently.</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return <View style={styles.infoRow}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#F4F6F9"},content:{padding:18,paddingBottom:34},back:{color:"#946600",fontSize:15,fontWeight:"800",marginBottom:18},hero:{backgroundColor:"#101827",borderRadius:16,padding:22,alignItems:"flex-start",marginBottom:14},avatar:{width:60,height:60,borderRadius:18,backgroundColor:"#F5B82E",alignItems:"center",justifyContent:"center",marginBottom:15},avatarText:{fontSize:26,fontWeight:"900",color:"#101827"},kicker:{fontSize:10,fontWeight:"900",letterSpacing:1.4,color:"#F5B82E"},heroTitle:{fontSize:26,fontWeight:"900",color:"#FFFFFF",marginTop:5},emptyTitle:{fontSize:22,fontWeight:"900",color:"#101827",textAlign:"center"},handle:{color:"#C7D0DE",fontSize:14,marginTop:4},pill:{backgroundColor:"#DDF7E8",borderRadius:20,paddingHorizontal:10,paddingVertical:5,marginTop:12},pillText:{color:"#176B46",fontSize:10,fontWeight:"900",letterSpacing:0.7},card:{backgroundColor:"#FFFFFF",borderRadius:13,padding:17,marginBottom:12,borderWidth:1,borderColor:"#E3E8EF"},sectionTitle:{fontSize:16,fontWeight:"900",color:"#101827",marginBottom:12},infoRow:{paddingVertical:9,borderBottomWidth:1,borderBottomColor:"#EEF1F5",gap:4},label:{fontSize:11,fontWeight:"800",color:"#657287",textTransform:"uppercase",letterSpacing:0.5},value:{fontSize:15,color:"#101827",fontWeight:"600"},body:{fontSize:14,lineHeight:21,color:"#465367"},footer:{fontSize:12,lineHeight:18,color:"#657287",textAlign:"center",paddingHorizontal:4,marginTop:4},loader:{marginTop:60},empty:{backgroundColor:"#FFFFFF",padding:22,borderRadius:14,alignItems:"center"},button:{backgroundColor:"#F5B82E",padding:13,borderRadius:10,marginTop:16},buttonText:{color:"#101827",fontWeight:"900"}
});
