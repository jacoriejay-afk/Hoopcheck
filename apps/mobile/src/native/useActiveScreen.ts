import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

export function useActiveScreen() {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(() => AppState.currentState !== "background" && AppState.currentState !== "inactive");
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => listener.remove();
  }, []);
  return focused && foreground;
}
