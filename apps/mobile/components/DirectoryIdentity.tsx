import { Image, View } from "react-native";
import { useEffect, useState } from "react";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { Chip } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { crestColor, crestInitials } from "../src/crest";
import { countryFlag } from "../src/countryFlag";

type CrestProps = { name: string; kind?: "teams" | "women" | "leagues"; size?: number; logoUrl?: string | null };
export function DirectoryCrest({ name, kind = "teams", size = 48, logoUrl }: CrestProps) {
  let url: string | null = null;
  try {
    const value = new URL(logoUrl || "");
    if (value.protocol === "https:" && !value.username && !value.password) url = value.toString();
  } catch { /* Invalid or missing artwork uses the named fallback. */ }
  return <CrestSurface key={JSON.stringify([name, kind, url])} name={name} kind={kind} size={size} url={url} />;
}
function CrestSurface({name,kind,size,url}:{name:string;kind:NonNullable<CrestProps["kind"]>;size:number;url:string|null}) {
  const t = useEntryTheme();
  const initials = crestInitials(name);
  const [failed,setFailed]=useState(false);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    if(!url || failed || loaded)return;
    const timer=setTimeout(()=>setFailed(true),8000);
    return ()=>clearTimeout(timer);
  },[url,failed,loaded]);
  const officialImage = Boolean(url && !failed);
  return <View accessible accessibilityRole="image" accessibilityLabel={loaded && officialImage ? name + " logo" : name + " initials badge"} style={{ alignSelf: "flex-start", padding: 6, borderRadius: 14, backgroundColor: t.crest.panel, borderWidth: 1, borderColor: t.crest.border, borderLeftWidth: 4, borderLeftColor: kind === "teams" ? t.button : t.roles[kind] }}>
    <View style={{width:size,height:size}}>
      {(!officialImage || !loaded) ? <Svg width={size} height={size} viewBox="0 0 100 100" style={{ backgroundColor: crestColor(name) }}>
        <Path d="M22 6H78L96 50 78 94H22L4 50Z" fill="none" stroke={t.crest.ink} strokeWidth={4} />
        <SvgText x={50} y={57} textAnchor="middle" alignmentBaseline="central" fill={t.crest.ink} fontSize={initials.length > 1 ? 30 : 36} fontWeight="900" fontFamily={t.type.fontFamily}>{initials}</SvgText>
      </Svg> : null}
      {officialImage ? <Image accessible={false} source={{uri:url!}} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)} resizeMode="contain" style={{position:"absolute",top:0,left:0,width:size,height:size,opacity:loaded?1:0}} /> : null}
    </View>
  </View>;
}
export function CountryChip({ country }: { country: string | null | undefined }) {
  if (!country) return null;
  return <View style={{ alignSelf: "flex-start" }}><Chip>{[countryFlag(country), country].filter(Boolean).join(" ")}</Chip></View>;
}
