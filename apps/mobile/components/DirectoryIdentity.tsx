import { Image, View } from "react-native";
import { useEffect, useState } from "react";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { Chip } from "../src/primitives";
import { useEntryTheme } from "../src/theme";
import { crestColor, crestInitials } from "../src/crest";
import { countryFlag } from "../src/countryFlag";

export function DirectoryCrest({ name, kind = "teams", size = 48, logoUrl }: { name: string; kind?: "teams" | "women" | "leagues"; size?: number; logoUrl?: string | null }) {
  const t = useEntryTheme();
  const initials = crestInitials(name);
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[logoUrl]);
  const officialImage = typeof logoUrl === "string" && /^https:\/\/[^\s]+$/i.test(logoUrl) && !failed;
  return <View accessible accessibilityRole="image" accessibilityLabel={`${name} crest`} style={{ alignSelf: "flex-start", padding: 6, borderRadius: 14, backgroundColor: t.crest.panel, borderWidth: 1, borderColor: t.crest.border, borderLeftWidth: 4, borderLeftColor: kind === "teams" ? t.button : t.roles[kind] }}>
    {officialImage ? <Image accessibilityLabel={`${name} league logo`} source={{uri:logoUrl!}} onError={()=>setFailed(true)} resizeMode="contain" style={{width:size,height:size}} /> : <Svg width={size} height={size} viewBox="0 0 100 100" style={{ backgroundColor: crestColor(name) }}>
      <Path d="M22 6H78L96 50 78 94H22L4 50Z" fill="none" stroke={t.crest.ink} strokeWidth={4} />
      <SvgText x={50} y={57} textAnchor="middle" alignmentBaseline="central" fill={t.crest.ink} fontSize={initials.length > 1 ? 30 : 36} fontWeight="900" fontFamily={t.type.fontFamily}>{initials}</SvgText>
    </Svg>}
  </View>;
}
export function CountryChip({ country }: { country: string | null | undefined }) {
  if (!country) return null;
  return <View style={{ alignSelf: "flex-start" }}><Chip>{[countryFlag(country), country].filter(Boolean).join(" ")}</Chip></View>;
}
