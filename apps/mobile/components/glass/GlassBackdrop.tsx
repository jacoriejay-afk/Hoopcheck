import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { StyleSheet } from "react-native";
import { glassTokens as glass } from "../../src/glassTheme";

const locations = {
  home: { orange: ["16%", "12%"], violet: ["96%", "45%"], teal: ["-5%", "72%"], pink: ["92%", "97%"] },
  live: { orange: ["80%", "8%"], violet: ["5%", "32%"], teal: ["86%", "76%"], pink: ["12%", "95%"] },
  team: { orange: ["22%", "17%"], violet: ["90%", "47%"], teal: ["8%", "82%"], pink: ["92%", "90%"] },
  feed: { orange: ["90%", "16%"], violet: ["8%", "38%"], teal: ["98%", "70%"], pink: ["10%", "94%"] },
} as const;

/** Static, low-opacity radial artwork: no animated blur or offscreen textures. */
export function GlassBackdrop({ screen }: { screen: keyof typeof locations }) {
  const p = locations[screen];
  return <Svg pointerEvents="none" accessible={false} width="100%" height="100%"
    style={StyleSheet.absoluteFillObject} preserveAspectRatio="xMidYMid slice">
    <Defs>
      {([["orange",glass.orange],["violet",glass.violet],["teal",glass.teal],["pink",glass.pink]] as const).map(([name,color]) =>
        <RadialGradient key={name} id={name} cx={p[name][0]} cy={p[name][1]} rx="55%" ry="34%">
          <Stop offset="0" stopColor={color} stopOpacity={.17} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>)}
    </Defs>
    {(["orange","violet","teal","pink"] as const).map(name=><Rect key={name} width="100%" height="100%" fill={`url(#${name})`} />)}
  </Svg>;
}
