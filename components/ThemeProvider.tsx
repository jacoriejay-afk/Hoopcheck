"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { normalizeThemePreference, usesDarkPalette, type ThemePreference } from "../lib/theme-preference";

export type { ThemePreference } from "../lib/theme-preference";
type ThemeContextValue = { theme: ThemePreference; setTheme: (theme: ThemePreference) => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);
function readThemeCookie(): ThemePreference | null {
  const match = document.cookie.match(/(?:^|;\s*)hoopcheck-theme=([^;]+)/);
  if (!match) return null;
  try { return normalizeThemePreference(decodeURIComponent(match[1])); } catch { return normalizeThemePreference(match[1]); }
}

function applyThemeToDocument(preference: ThemePreference) {
  const dark = usesDarkPalette(preference, window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("theme-dark", dark);
  root.classList.toggle("theme-light", !dark);
  root.classList.toggle("theme-midnight", preference === "midnight");
  root.style.colorScheme = dark ? "dark" : "light";
  localStorage.setItem("hoopcheck-theme", preference);
  document.cookie = `hoopcheck-theme=${encodeURIComponent(preference)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export default function ThemeProvider({
  children,
  initialTheme = "system",
}: {
  children: React.ReactNode;
  initialTheme?: ThemePreference;
}) {
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme);
  const preferenceRef = useRef<ThemePreference>(initialTheme);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    const normalized = normalizeThemePreference(nextTheme);
    preferenceRef.current = normalized;
    setThemeState(normalized);
    applyThemeToDocument(normalized);
  }, []);

  useEffect(() => {
    let stored: ThemePreference = initialTheme;
    try {
      stored = normalizeThemePreference(localStorage.getItem("hoopcheck-theme") || readThemeCookie() || initialTheme);
      setTheme(stored);
    } catch {
      setTheme(initialTheme);
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (preferenceRef.current === "system") applyThemeToDocument("system");
    };
    media.addEventListener?.("change", onSystemChange);
    return () => media.removeEventListener?.("change", onSystemChange);
  }, [initialTheme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside the root ThemeProvider.");
  return value;
}
