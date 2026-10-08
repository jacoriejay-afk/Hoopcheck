"use client";

import { useEffect } from "react";
import { getCachedSession, supabase } from "../lib/supabase";

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
    getCachedSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      const { data: prefs } = await supabase.from("user_preferences").select("theme,language").eq("user_id", user.id).maybeSingle();
      if (prefs?.theme) apply(prefs.theme);
      if (prefs?.language) { document.documentElement.lang = prefs.language; localStorage.setItem("hoopcheck-language", prefs.language); }
    });
    return () => { active = false; };
  }, []);
  return <>{children}</>;
}
