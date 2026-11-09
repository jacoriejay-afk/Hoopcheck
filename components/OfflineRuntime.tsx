"use client";

import { useEffect, useState } from "react";

export default function OfflineRuntime() {
  const [offline, setOffline] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    const updateNetwork = () => setOffline(!navigator.onLine);
    updateNetwork();
    void fetch("/api/app-version", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((payload) => {
      const nextVersion = typeof payload?.version === "string" ? payload.version : null;
      if (!nextVersion) return;
      setCurrentVersion(nextVersion);
      const previousVersion = localStorage.getItem("hoopcheck-app-version");
      if (previousVersion && previousVersion !== nextVersion) setUpdateReady(true);
      else if (!previousVersion) localStorage.setItem("hoopcheck-app-version", nextVersion);
    }).catch(() => {});
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);

    if (!("serviceWorker" in navigator)) {
      return () => {
        window.removeEventListener("online", updateNetwork);
        window.removeEventListener("offline", updateNetwork);
      };
    }

    let active = true;
    let refreshing = false;
    let hadController = Boolean(navigator.serviceWorker.controller);
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (!active) return;
        setRegistration(reg);
        if (reg.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
        if (reg.waiting && !navigator.serviceWorker.controller) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(true);
          });
        });
      } catch {
        // Offline support is progressive enhancement; the online app remains usable.
      }
    };
    void register();
    const onControllerChange = () => {
      // First install can claim the already-current page without reloading it.
      // Reload only when a worker replaces one that controlled this document.
      if (!hadController) { hadController = true; return; }
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      active = false;
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  function applyUpdate() {
    if (currentVersion) localStorage.setItem("hoopcheck-app-version", currentVersion);
    if (registration?.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    else window.location.reload();
  }

  if (!offline && !updateReady) return null;
  return (
    <div className="hc-runtime-notices" aria-live="polite">
      {offline && <span className="hc-runtime-notice hc-runtime-notice--offline">Offline — limited saved content</span>}
      {updateReady && <button type="button" className="hc-runtime-notice hc-runtime-notice--update" onClick={applyUpdate}>Update ready — tap to refresh</button>}
      <style jsx>{`
        .hc-runtime-notices{position:fixed;z-index:1000;left:50%;bottom:calc(78px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;width:max-content;max-width:calc(100vw - 24px);pointer-events:none}
        .hc-runtime-notice{display:block;border:1px solid var(--hc-border,#444);border-radius:999px;padding:8px 13px;background:var(--hc-surface-raised,#171717);color:var(--hc-foreground,#f5f5f0);font:600 12px/1.3 var(--font-sans),Arial,sans-serif;box-shadow:0 4px 18px #0002;pointer-events:auto}
        .hc-runtime-notice--update{border-color:var(--hc-orange,#ff5a1f);cursor:pointer}
      `}</style>
    </div>
  );
}
