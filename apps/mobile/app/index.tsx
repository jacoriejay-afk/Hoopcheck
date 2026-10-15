import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topline}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>HC</Text><View style={styles.markArrow} /></View>
          <Text style={styles.wordmark}>HOOP<Text style={styles.wordmarkAccent}>CHECK</Text></Text>
        </View>
        <View style={styles.kickerRow}><View style={styles.liveDot} /><Text style={styles.kicker}>BUILT FOR THE INTERNATIONAL GAME</Text></View>
        <Text style={styles.headline}>DON’T SIGN{"\n"}IN THE <Text style={styles.headlineAccent}>DARK.</Text></Text>
        <Text style={styles.description}>Know who you’re signing with. Research teams, coaches, and leagues through the experiences of players who have been there.</Text>
        <View style={styles.courtPanel}>
          <Text style={styles.courtCaption}>YOUR CAREER. YOUR CALL.</Text>
          <View style={styles.court}><View style={styles.courtMidline} /><View style={styles.courtCircle} /><View style={styles.courtKeyLeft} /><View style={styles.courtKeyRight} /><View style={styles.courtArrow}><Text style={styles.courtArrowText}>↗</Text></View></View>
          <Text style={styles.courtFoot}><Text style={styles.orangeText}>01</Text>  RESEARCH BEFORE YOU COMMIT</Text>
        </View>
        <View style={styles.categoryGrid}>
          <View style={styles.categoryCard}><Text style={styles.categoryNo}>01 / DIRECTORY</Text><Text style={styles.categoryTitle}>TEAMS</Text><Text style={styles.categoryCaption}>Research the organization</Text></View>
          <View style={styles.categoryCard}><Text style={styles.categoryNo}>02 / PEOPLE</Text><Text style={styles.categoryTitle}>COACHES</Text><Text style={styles.categoryCaption}>Know who you’ll work with</Text></View>
          <View style={styles.categoryCard}><Text style={styles.categoryNo}>03 / COMPETITION</Text><Text style={styles.categoryTitle}>LEAGUES</Text><Text style={styles.categoryCaption}>Explore the market</Text></View>
          <View style={styles.categoryCard}><Text style={styles.categoryNo}>04 / COMMUNITY</Text><Text style={styles.categoryTitle}>PLAYER VOICES</Text><Text style={styles.categoryCaption}>Learn from shared experience</Text></View>
        </View>
        <Link href="/sign-in" style={styles.primaryButton}><Text style={styles.primaryButtonText}>GET STARTED  ↗</Text></Link>
        <Link href="/sign-up" style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>CREATE AN ACCOUNT</Text></Link>
        <Text style={styles.footer}>BUILT FOR PLAYERS NAVIGATING BASKETBALL WORLDWIDE</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:"#050505"},
  container:{flexGrow:1,paddingHorizontal:20,paddingTop:22,paddingBottom:36},
  topline:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:40},
  brandMark:{width:46,height:46,borderWidth:2,borderColor:"#F4F4F4",alignItems:"center",justifyContent:"center",position:"relative"},
  brandMarkText:{color:"#FF6A00",fontSize:17,fontWeight:"900",letterSpacing:-1},
  markArrow:{position:"absolute",width:16,height:3,backgroundColor:"#FF6A00",right:-4,top:10,transform:[{rotate:"-38deg"}]},
  wordmark:{color:"#FFFFFF",fontSize:26,fontWeight:"900",letterSpacing:-1.2},
  wordmarkAccent:{color:"#FF6A00"},
  kickerRow:{flexDirection:"row",alignItems:"center",gap:8,marginBottom:18},
  liveDot:{width:7,height:7,borderRadius:4,backgroundColor:"#FF6A00"},
  kicker:{color:"#FF6A00",fontSize:10,fontWeight:"900",letterSpacing:1.4},
  headline:{color:"#FFFFFF",fontSize:48,fontWeight:"900",lineHeight:47,letterSpacing:-1.5},
  headlineAccent:{color:"#FF6A00"},
  description:{color:"#C6C6C6",fontSize:15,lineHeight:23,marginTop:16,marginBottom:22},
  courtPanel:{backgroundColor:"#101010",borderWidth:1,borderColor:"#303030",padding:14,marginBottom:22},
  courtCaption:{color:"#FF6A00",fontSize:10,fontWeight:"900",letterSpacing:1.4,marginBottom:12},
  court:{height:155,borderWidth:1,borderColor:"#FF6A00",backgroundColor:"#0A0A0A",alignItems:"center",justifyContent:"center",overflow:"hidden"},
  courtMidline:{position:"absolute",width:1,height:"100%",backgroundColor:"#71320D"},
  courtCircle:{position:"absolute",width:82,height:82,borderRadius:42,borderWidth:1,borderColor:"#FF6A00"},
  courtKeyLeft:{position:"absolute",left:0,width:44,height:70,borderWidth:1,borderColor:"#FF6A00",borderLeftWidth:0},
  courtKeyRight:{position:"absolute",right:0,width:44,height:70,borderWidth:1,borderColor:"#FF6A00",borderRightWidth:0},
  courtArrow:{width:58,height:58,borderRadius:29,borderWidth:1,borderColor:"#FF6A00",backgroundColor:"#16100B",alignItems:"center",justifyContent:"center"},
  courtArrowText:{color:"#FF6A00",fontSize:34,fontWeight:"900"},
  courtFoot:{color:"#E5E5E5",fontSize:10,fontWeight:"800",letterSpacing:1,marginTop:12},
  orangeText:{color:"#FF6A00"},
  categoryGrid:{flexDirection:"row",flexWrap:"wrap",gap:10,marginBottom:22},
  categoryCard:{width:"48%",minHeight:112,flexGrow:1,flexBasis:"44%",backgroundColor:"#101010",borderWidth:1,borderTopWidth:3,borderTopColor:"#FF6A00",borderColor:"#303030",padding:12,justifyContent:"space-between"},
  categoryNo:{color:"#FF6A00",fontSize:9,fontWeight:"900",letterSpacing:1},
  categoryTitle:{color:"#FFFFFF",fontSize:21,fontWeight:"900",marginTop:13,letterSpacing:-.3},
  categoryCaption:{color:"#999999",fontSize:11,lineHeight:15,marginTop:3},
  primaryButton:{backgroundColor:"#FF6A00",minHeight:54,alignItems:"center",justifyContent:"center",padding:16,borderRadius:2},
  primaryButtonText:{color:"#050505",fontSize:14,fontWeight:"900",letterSpacing:1},
  secondaryButton:{borderColor:"#555555",borderWidth:1,minHeight:52,alignItems:"center",justifyContent:"center",padding:15,marginTop:10,borderRadius:2},
  secondaryButtonText:{color:"#FFFFFF",fontSize:12,fontWeight:"900",letterSpacing:1},
  footer:{color:"#777777",fontSize:9,fontWeight:"800",letterSpacing:1,marginTop:28,textAlign:"center",lineHeight:15}
});
