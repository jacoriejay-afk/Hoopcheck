"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase";

type ThemePreference = "system" | "light" | "dark";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let active = true;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let preference: ThemePreference = "system";

    const normalize = (value: string | null): ThemePreference =>
      value === "dark" || value === "light" || value === "system" ? value : "system";

    const apply = (next?: string) => {
      if (next) preference = normalize(next);
      if (!active) return;
      const isDark = preference === "dark" || (preference === "system" && media.matches);
      // The existing "dynamic" design token set is HoopCheck's dark surface theme.
      document.documentElement.dataset.theme = isDark ? "dynamic" : "light";
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
      localStorage.setItem("hoopcheck-theme", preference);
    };

    preference = normalize(localStorage.getItem("hoopcheck-theme"));
    apply();
    const onThemeChange = (event: Event) => apply((event as CustomEvent<string>).detail);
    const onSystemChange = () => { if (preference === "system") apply(); };
    window.addEventListener("hoopcheck-theme-change", onThemeChange);
    media.addEventListener?.("change", onSystemChange);

    const loadUserPreference = async (userId: string) => {
      const { data } = await supabase.from("profiles").select("theme_preference").eq("id", userId).maybeSingle();
      if (!active || !data) return;
      preference = normalize(data.theme_preference);
      apply();
    };
    void supabase.auth.getUser().then(({ data }) => { if (data.user) void loadUserPreference(data.user.id); });
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
        void loadUserPreference(session.user.id);
      }
    });

    return () => {
      active = false;
      window.removeEventListener("hoopcheck-theme-change", onThemeChange);
      media.removeEventListener?.("change", onSystemChange);
      authListener.subscription.unsubscribe();
    };
  }, []);
  return <>{children}</>;
}
