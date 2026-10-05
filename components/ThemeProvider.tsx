"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let active = true;
    const apply = (theme: string) => {
      if (!active) return;
      const value = theme === "light" || theme === "dynamic" ? theme : "dark";
      document.documentElement.dataset.theme = value;
      localStorage.setItem("hoopcheck-theme", value);
    };
    apply(localStorage.getItem("hoopcheck-theme") || "dynamic");
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: prefs } = await supabase.from("user_preferences").select("theme").eq("user_id", data.user.id).maybeSingle();
      if (prefs?.theme) apply(prefs.theme);
    });
    return () => { active = false; };
  }, []);
  return <>{children}</>;
}
