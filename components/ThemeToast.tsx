"use client";

import type { ReactNode } from "react";

type ThemeToastProps = {
  children: ReactNode;
  tone?: "success" | "error" | "info";
  className?: string;
};

export default function ThemeToast({ children, tone = "success", className = "" }: ThemeToastProps) {
  return (
    <div
      className={`hc-toast hc-toast--${tone} ${className}`.trim()}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      data-hc-surface="true"
    >
      <span className="hc-toast__icon" aria-hidden="true">
        {tone === "success" ? "✓" : tone === "error" ? "!" : "i"}
      </span>
      <span className="hc-toast__message">{children}</span>
    </div>
  );
}
