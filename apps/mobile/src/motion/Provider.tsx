import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo } from "react-native";
import { ReduceMotion, ReducedMotionConfig, useReducedMotion } from "react-native-reanimated";

const Context = createContext(false);
export function MotionProvider({ children }: { children: ReactNode }) {
  const initial = useReducedMotion();
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; listener.remove(); };
  }, []);
  return <Context.Provider value={reduced}><ReducedMotionConfig mode={reduced ? ReduceMotion.Always : ReduceMotion.System} />{children}</Context.Provider>;
}
export const useMotionSetting = () => useContext(Context);
