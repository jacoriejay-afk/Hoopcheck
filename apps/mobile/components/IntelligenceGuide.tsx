import {useState} from "react";
import {Text,View} from "react-native";
import {useRouter} from "expo-router";
import {Button,GlassCard,Input} from "../src/primitives";
import {useEntryTheme} from "../src/theme";
import {findIntelligenceTopics,intelligenceTopics,type IntelligenceTopic} from "../src/native/intelligenceGuide";
export function IntelligenceGuide(){
 const t=useEntryTheme(),router=useRouter();
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[result,setResult]=useState<IntelligenceTopic[]|null>(null);
 function search(value:string){setQuery(value);setResult(findIntelligenceTopics(value));}
 return <GlassCard style={{gap:8}}><Text accessibilityRole="header" style={{color:t.foreground,fontWeight:"800",fontSize:19}}>HoopCheck Intelligence</Text><Text style={{color:t.muted}}>Find relevant reviewed basketball guidance. This is a limited offline lookup, not a live AI assistant.</Text><Button secondary onPress={()=>setOpen(v=>!v)}>{open?"Close guidance":"Ask a basketball question"}</Button>
 {open?<><Input accessibilityLabel="Basketball question" maxLength={160} value={query} onChangeText={v=>{setQuery(v);setResult(null);}} placeholder="How do I verify a club?" onSubmitEditing={()=>search(query)}/><Button disabled={query.trim().length<3} onPress={()=>search(query)}>Find guidance</Button><View style={{gap:6}}>{intelligenceTopics.map(topic=><Button key={topic.id} secondary onPress={()=>search(topic.phrases[0])}>{topic.title}</Button>)}</View>
 {result===null?null:result.length?result.map(topic=><View key={topic.id} style={{gap:6}}><Text style={{color:t.foreground,fontWeight:"800"}}>{topic.title}</Text><Text style={{color:t.foreground}}>{topic.answer}</Text><Text style={{color:t.muted}}>Source: {topic.source}</Text><Button secondary onPress={()=>router.push(topic.nativePath)}>Open related HoopCheck tool</Button></View>):<Text accessibilityLiveRegion="polite" style={{color:t.muted}}>No supported guidance matched. Search the directory for actual team or player records.</Text>}</>:null}</GlassCard>;
}
