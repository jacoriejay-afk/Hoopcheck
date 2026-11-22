import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useMotionSetting } from "../src/motion/Provider";
import { ArenaBrand } from "./ArenaBrand";

let hasPlayedColdOpen = false;

/** Short native-only opening. Never delays auth, deep links, or native splash deadlines. */
export function AppOpening({ ready, disabled = false }: { ready: boolean; disabled?: boolean }) {
  const reduced = useMotionSetting();
  const insets = useSafeAreaInsets();
  const [finished, setFinished] = useState(hasPlayedColdOpen || Platform.OS === "web");
  const [interrupted, setInterrupted] = useState(false);
  const started = useRef(false);
  const progress = useSharedValue(0);
  const exitOpacity = useSharedValue(1);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  function finish() {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    hasPlayedColdOpen = true;
    setFinished(true);
  }
  useEffect(() => {
    // An OAuth, recovery or session interruption must never replay a started opening.
    if ((!ready || disabled) && hasPlayedColdOpen && !finished && !interrupted) {
      setInterrupted(true);
      return;
    }
    if (interrupted || !ready || disabled || finished || started.current || Platform.OS === "web") return;
    started.current = true;
    hasPlayedColdOpen = true;
    progress.set(withTiming(1, { duration: reduced ? 0 : 580 }));
    timeouts.current.push(setTimeout(() => {
      exitOpacity.set(withTiming(0, { duration: reduced ? 0 : 140 }));
      timeouts.current.push(setTimeout(() => setFinished(true), reduced ? 0 : 160));
    }, reduced ? 70 : 760));
    return () => { timeouts.current.forEach(clearTimeout); timeouts.current = [];
      cancelAnimation(progress); cancelAnimation(exitOpacity);
      // Motion settings and route eligibility can change mid-opening. Reset
      // this guard so the effect is never stranded without a completion timer.
      started.current = false; };
  }, [ready, disabled, finished, interrupted, reduced, progress, exitOpacity]);
  const mark = useAnimatedStyle(() => ({
    opacity: .25 + .75 * progress.get(),
    transform: [{ translateY: 12 * (1-progress.get()) }, { scale: .84 + .16 * progress.get() }],
  }));
  const stripe = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scaleX: progress.get() }],
  }));
  const veil = useAnimatedStyle(() => ({ opacity: exitOpacity.get() }));
  // The effect cleanup resets its restart guard whenever the route or motion
  // setting changes, so a new finish timer can always be scheduled safely.
  if (finished || interrupted || Platform.OS === "web" || disabled || !ready) return null;
  return <Animated.View testID="brand-cold-open" accessibilityViewIsModal={true}
    style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100, backgroundColor: "#071426" }, veil]}>
    <LinearGradient colors={["#060E1D", "#102748", "#291625"]} start={{x:0,y:0}} end={{x:1,y:1}}
      style={StyleSheet.absoluteFill}/>
    <View pointerEvents="none" accessible={false} style={{position:"absolute",left:-120,right:-120,
      top:"24%",height:280,borderRadius:200,borderWidth:1,borderColor:"rgba(97,173,255,.18)",
      transform:[{rotate:"-18deg"}]}}/>
    <View pointerEvents="none" accessible={false} style={{position:"absolute",left:-80,right:-140,
      top:"30%",height:220,borderRadius:180,borderWidth:1,borderColor:"rgba(255,122,43,.20)",
      transform:[{rotate:"18deg"}]}}/>
    <View style={{flex:1,justifyContent:"center",alignItems:"center",paddingHorizontal:20}}>
      <Animated.View style={mark}><ArenaBrand size={156}/></Animated.View>
      <Animated.View pointerEvents="none" style={[{marginTop:20,height:3,width:150,
        borderRadius:4,backgroundColor:"#FF772F"}, stripe]}/>
      <Text style={{marginTop:17,color:"#D0DCEB",fontSize:11,fontWeight:"700",
        letterSpacing:2.2,textAlign:"center"}}>THE COURT IS OPEN</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Skip opening animation"
      onPress={finish} style={{position:"absolute",top:insets.top+8,right:15,minHeight:44,minWidth:60,
        justifyContent:"center",alignItems:"center"}}>
      <Text style={{color:"#FFFFFF",fontWeight:"700",fontSize:12}}>Skip</Text>
    </Pressable>
  </Animated.View>;
}
