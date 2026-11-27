import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { GlassCard, Button } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { contractCountdownDays } from "../src/native/contractCountdown";

/** Mounted only for the verified owner of an eligible player profile. No persistence. */
export function PrivateContractCountdown() {
  const t = useEntryTheme();
  const [date, setDate] = useState("");
  const [now, setNow] = useState(() => new Date());
  const days = contractCountdownDays(date, now);
  const result = days === null ? (date.length === 10 ? "Enter a valid date." : "") :
    days === 0 ? "Ends today" :
    days > 0 ? `${days} calendar ${days === 1 ? "day" : "days"} remaining` :
    `Entered end date passed ${-days} ${days === -1 ? "day" : "days"} ago`;
  return <GlassCard style={{gap:10}}>
    <Text accessibilityRole="header" style={{color:t.foreground,fontWeight:"800",fontSize:18}}>Private contract countdown</Text>
    <Text style={{color:t.muted}}>Enter your contract end date. This is a personal estimate, not a verified contract record. It is not saved or shared, and does not schedule a reminder.</Text>
    <TextInput accessibilityLabel="Contract end date (YYYY-MM-DD)" placeholder="YYYY-MM-DD" placeholderTextColor={t.muted} autoCorrect={false} autoCapitalize="none" maxLength={10} value={date} onChangeText={value=>{setDate(value);setNow(new Date());}} style={{minHeight:48,paddingHorizontal:12,borderWidth:1,borderColor:t.border,borderRadius:t.radius.control,color:t.foreground,backgroundColor:t.input}} />
    {result ? <Text accessibilityLiveRegion="polite" style={{color:t.foreground,fontWeight:"700",fontSize:16}}>{result}</Text> : null}
    {date ? <View style={{gap:6}}><Button secondary onPress={()=>setNow(new Date())}>Refresh countdown</Button><Button secondary onPress={()=>{setDate("");setNow(new Date());}}>Clear date</Button></View> : null}
  </GlassCard>;
}
