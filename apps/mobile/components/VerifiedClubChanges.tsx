import {Text,View} from "react-native";
import {useEntryTheme} from "../src/theme";
import {verifiedClubChanges,type VerifiedClubClaim} from "../src/native/verifiedClubChanges";
export function VerifiedClubChanges({claims,partial}:{claims:VerifiedClubClaim[];partial:boolean}){
 const t=useEntryTheme();
 if(process.env.EXPO_PUBLIC_HOOPCHECK_CLUB_CHANGES_ENABLED!=="true")return null;
 const report=verifiedClubChanges(claims,partial);
 return <View style={{gap:8}}><Text accessibilityRole="header" style={{color:t.foreground,fontSize:19,fontWeight:"800"}}>Verified club chronology</Text><Text style={{color:t.muted}}>Only your separately verified, dated career records are compared. Not official transfer announcements or confirmed signing dates. This view is private.</Text>{report.state==="unavailable"?<Text style={{color:t.muted}}>Chronology unavailable: verified dates, club identity, or complete records are missing or overlap.</Text>:report.changes.length?report.changes.map(change=><View key={change.id} style={{gap:4,paddingVertical:8,borderBottomWidth:1,borderColor:t.border}}><Text style={{color:t.foreground,fontWeight:"800"}}>{change.from} → {change.to}</Text><Text style={{color:t.muted}}>{change.lastRecordedEnd} (recorded end) · {change.nextRecordedStart} (recorded start)</Text></View>):<Text style={{color:t.muted}}>No dated change between verified club records is available.</Text>}</View>;
}
