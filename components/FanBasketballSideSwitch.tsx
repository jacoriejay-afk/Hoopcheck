"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type BasketballSide = "mens" | "womens";
const STORAGE_KEY = "hoopcheck:fan-basketball-side";
const SIDE_EVENT = "hoopcheck:fan-basketball-side-change";

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
  const [side, setSide] = useState<BasketballSide>("mens");
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
        supabase.from("subscriptions").select("plan,status,current_period_end").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!alive) return;
      const fan = profile?.account_type === "fan";
      const active = ["active", "trialing"].includes(subscription?.status || "") &&
        (!subscription?.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now());
      const premiumTier = active && ["pro", "premium"].includes(subscription?.plan || "");
      setIsFan(fan);
      setCanSwitch(fan && premiumTier);
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
      const restored = local === "mens" || local === "womens" ? local : preferred;
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
  }, [canSwitch]);

  if (!ready || !isFan) return null;
  if (!canSwitch) return lockedHint ? <div className="hc-fan-side-locked" role="note">🔒 Available on Fan Pro · <a href="/membership">Upgrade</a></div> : null;

  return (
    <div className="hc-fan-side-switch-wrap" aria-label="Basketball side">
      <div className="hc-fan-side-switch" role="group" aria-label="Choose basketball side">
        <button type="button" aria-pressed={side === "mens"} className={side === "mens" ? "is-active is-mens" : ""} onClick={() => void choose("mens")}>MEN&apos;S</button>
        <button type="button" aria-pressed={side === "womens"} className={side === "womens" ? "is-active is-womens" : ""} onClick={() => void choose("womens")}>WOMEN&apos;S</button>
      </div>
    </div>
  );
}
