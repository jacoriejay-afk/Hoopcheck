import { useMotionSetting } from "../src/motion/Provider";
import { useEffect, useRef, type ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { BlurView } from "expo-blur";
import { ReduceMotion } from "react-native-reanimated";
import { useEntryTheme } from "../src/theme";
import { motion } from "../src/motion/config";

export function Sheet({ open, onClose, title, children, dismissible = true }: { dismissible?: boolean; open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<BottomSheetModal>(null);
  const theme = useEntryTheme();
  const reduced = useMotionSetting();
  useEffect(() => { if (open) ref.current?.present(); else ref.current?.dismiss(); }, [open]);
  return <BottomSheetModal ref={ref} onDismiss={onClose} enablePanDownToClose={dismissible} enableDynamicSizing keyboardBehavior="interactive" keyboardBlurBehavior="restore"
    overrideReduceMotion={reduced ? ReduceMotion.Always : ReduceMotion.System} animateOnMount={!reduced} animationConfigs={motion.spring}
    backgroundStyle={{ backgroundColor: theme.surface }} handleIndicatorStyle={{ backgroundColor: theme.muted }}
    backdropComponent={props => <><BlurView pointerEvents="none" tint={theme.dark ? "dark" : "light"} intensity={24} style={props.style} /><BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior={dismissible ? "close" : "none"} /></>}>
    <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 16 }}>
      <Text accessibilityRole="header" style={{ color: theme.foreground, fontSize: 23, fontWeight: "800" }}>{title}</Text>
      {children}
      <Pressable accessibilityRole="button" disabled={!dismissible} accessibilityState={{ disabled: !dismissible }} onPress={() => ref.current?.dismiss()} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: theme.accent }}>Close</Text></Pressable>
    </BottomSheetScrollView>
  </BottomSheetModal>;
}
