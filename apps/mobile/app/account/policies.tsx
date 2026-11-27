import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useEntryTheme } from "../../src/theme";
import { Button } from "../../src/primitives";
import { legalDocuments } from "../../src/native/legalDocuments";

export default function Policies(){
  const {kind}=useLocalSearchParams<{kind?:string}>(),router=useRouter(),theme=useEntryTheme();
  const current=kind==="terms"?"terms":"privacy";
  const doc=legalDocuments[current];
  return <ScrollView style={{flex:1,backgroundColor:theme.background}} contentContainerStyle={{padding:18,paddingBottom:100,gap:12,maxWidth:760,width:"100%",alignSelf:"center"}}>
    <Stack.Screen options={{title:doc.title}}/>
    <Text accessibilityRole="header" style={{fontSize:28,fontFamily:"HoopCheckDisplay",color:theme.foreground}}>{doc.title}</Text>
    <Text style={{color:theme.muted,lineHeight:22}}>{doc.intro}</Text>
    {doc.blocks.map((block,index)=><Text key={index} accessibilityRole={block.kind==="h2"?"header":undefined} selectable style={{color:theme.foreground,fontSize:block.kind==="h2"?19:15,fontWeight:block.kind==="h2"?"700":"400",lineHeight:block.kind==="h2"?25:23,marginTop:block.kind==="h2"?10:0}}>{block.kind==="li"?"• ":""}{block.text}</Text>)}
    <View style={{gap:8}}>
      <Button secondary onPress={()=>router.replace({pathname:"/account/policies",params:{kind:current==="terms"?"privacy":"terms"}})}>{current==="terms"?"Privacy Policy":"Terms of Service"}</Button>
      <Button secondary onPress={()=>router.push("/account/support")}>Help & Support</Button>
      <Button secondary onPress={()=>router.push("/membership")}>Membership</Button>
    </View>
  </ScrollView>;
}
