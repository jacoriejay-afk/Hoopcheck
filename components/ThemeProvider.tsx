"use client";

import { useEffect } from "react";

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
    return () => { active = false; };
  }, []);
  return <>{children}</>;
}
