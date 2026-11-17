import { useCallback } from "react";
import * as Haptics from "expo-haptics";
import { useDevicePreferences } from "./preferences";

export type Feedback = "check" | "tab" | "posted" | "commented" | "reviewSubmitted" | "predictionWon" | "error";
export function useHaptics() {
  const { preferences } = useDevicePreferences();
  return useCallback((result: Feedback) => {
    if (!preferences.haptics) return;
    const task = result === "error"
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      : result === "reviewSubmitted" || result === "predictionWon"
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(result === "posted" || result === "commented" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    // Unsupported devices and system restrictions must never break an action.
    void task.catch(() => {});
  }, [preferences.haptics]);
}
