"use client";

import { useEffect } from "react";

export default function ProtectionLayer() {
  useEffect(() => {
    const block = (event: Event) => event.preventDefault();
    const key = (event: KeyboardEvent) => {
      const k = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && ((event.shiftKey && ["s","4","5"].includes(k)) || k === "p")) {
        event.preventDefault();
      }
    };
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("keydown", key);
    };
  }, []);

  return null;
}
