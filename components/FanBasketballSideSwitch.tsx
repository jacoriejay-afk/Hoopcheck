"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getHoopCheckEntitlements } from "../lib/membership-tier";

export type BasketballSide = "mens" | "womens";
const STORAGE_KEY = "hoopcheck:fan-basketball-side";
const SIDE_EVENT = "hoopcheck:fan-basketball-side-change";

const lockedHintCopy: Record<"en" | "es" | "fr" | "de" | "tr" | "pt" | "it" | "el" | "ar" | "ru" | "az" | "pl" | "zh" | "ja" | "sr" | "fi" | "he" | "lt" | "uk", { message: string; action: string }> = {
  en: { message: "Available with Fan Pro", action: "Upgrade" },
  es: { message: "Disponible con Fan Pro", action: "Mejorar plan" },
  fr: { message: "Disponible avec Fan Pro", action: "Passer à l’offre supérieure" },
  de: { message: "Mit Fan Pro verfügbar", action: "Upgrade" },
  tr: { message: "Fan Pro ile kullanılabilir", action: "Yükselt" },
  pt: { message: "Disponível no Fan Pro", action: "Fazer upgrade" },
  it: { message: "Disponibile con Fan Pro", action: "Passa al piano superiore" },
  el: { message: "Διαθέσιμο με Fan Pro", action: "Αναβάθμιση" },
  ar: { message: "متاح مع Fan Pro", action: "ترقية" },
  ru: { message: "Доступно с Fan Pro", action: "Улучшить план" },
  az: { message: "Fan Pro ilə əlçatandır", action: "Planı yüksəlt" },
  pl: { message: "Dostępne w Fan Pro", action: "Ulepsz plan" },
  zh: { message: "Fan Pro 会员可用", action: "升级" },
  ja: { message: "Fan Proで利用できます", action: "アップグレード" },
  sr: { message: "Dostupno uz Fan Pro", action: "Nadogradi" },
  fi: { message: "Käytettävissä Fan Pro -jäsenyydellä", action: "Päivitä" },
  he: { message: "זמין במסגרת Fan Pro", action: "שדרוג" },
  lt: { message: "Prieinama su Fan Pro", action: "Atnaujinti planą" },
  uk: { message: "Доступно з Fan Pro", action: "Оновити план" },
};


export function useFanBasketballSide() {
  const [side, setSideState] = useState<BasketballSide>("mens");
  useEffect(() => {
    const read = () => {
      const value = window.localStorage.getItem(STORAGE_KEY);
      if (value === "mens" || value === "womens") setSideState(value);
    };
    read();
    window.addEventListener(SIDE_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(SIDE_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return side;
}

export default function FanBasketballSideSwitch({ lockedHint = false }: { lockedHint?: boolean }) {
  const { t, language } = useLanguage();
  const mensLabel = t("mensTeams");
  const womensLabel = t("womensTeams");
  const sideLabel = `${mensLabel} / ${womensLabel}`;
  const [side, setSide] = useState<BasketballSide>("mens");
  const pathname = usePathname();
  const router = useRouter();
  const [isFan, setIsFan] = useState(false);
  const [canSwitch, setCanSwitch] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (alive) setReady(true); return; }
      const [{ data: profile }, { data: subscription }] = await Promise.all([
        supabase.from("profiles").select("account_type,preferred_basketball_side").eq("id", user.id).maybeSingle(),
        supabase.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!alive) return;
      const fan = profile?.account_type === "fan";
      const entitlements = getHoopCheckEntitlements({ accountType: profile?.account_type, subscription });
      setIsFan(fan);
      setCanSwitch(entitlements.canSwitchBasketballSide);
      let preferred = profile?.preferred_basketball_side as BasketballSide | null;
      if (preferred !== "mens" && preferred !== "womens") {
        const { data: follows } = await supabase.from("follow_relationships").select("target_type,target_id,created_at")
          .eq("follower_id", user.id).eq("target_type", "team").order("created_at", { ascending: true }).limit(1);
        const first = follows?.[0];
        if (first?.target_id) {
          const { data: womensTeam } = await supabase.from("womens_teams").select("id").eq("id", first.target_id).maybeSingle();
          preferred = womensTeam ? "womens" : "mens";
        } else {
          preferred = "mens";
        }
        await supabase.from("profiles").update({ preferred_basketball_side: preferred }).eq("id", user.id);
      }
      const local = window.localStorage.getItem(STORAGE_KEY);
      const restored = preferred === "mens" || preferred === "womens" ? preferred : local === "mens" || local === "womens" ? local : "mens";
      setSide(restored);
      window.localStorage.setItem(STORAGE_KEY, restored);
      window.dispatchEvent(new Event(SIDE_EVENT));
      setReady(true);
    };
    void initialize();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void initialize(); });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  const choose = useCallback(async (next: BasketballSide) => {
    if (!canSwitch) return;
    setSide(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(SIDE_EVENT));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("profiles").update({ preferred_basketball_side: next }).eq("id", user.id);
    if (pathname === "/teams" && next === "womens") router.push("/womens");
    else if (pathname === "/womens" && next === "mens") router.push("/teams");
    else if (pathname === "/search") {
      const params = new URLSearchParams(window.location.search);
      params.set("type", next === "womens" ? "womens-teams" : "mens-teams");
      router.replace(`/search?${params.toString()}`);
    }
  }, [canSwitch, pathname, router]);

  if (!ready || !isFan) return null;
  if (!canSwitch) { const copy = lockedHintCopy[language] || lockedHintCopy.en; return lockedHint ? <div className="hc-fan-side-locked" role="note">🔒 {copy.message} · <a href="/membership">{copy.action}</a></div> : null; }

  return (
    <div className="hc-fan-side-switch-wrap" aria-label={sideLabel}>
      <div className="hc-fan-side-switch" role="group" aria-label={sideLabel}>
        <button type="button" aria-pressed={side === "mens"} className={side === "mens" ? "is-active is-mens" : ""} onClick={() => void choose("mens")}>{mensLabel}</button>
        <button type="button" aria-pressed={side === "womens"} className={side === "womens" ? "is-active is-womens" : ""} onClick={() => void choose("womens")}>{womensLabel}</button>
      </div>
    </div>
  );
}
