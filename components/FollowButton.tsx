"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { HoopIcon } from "./HoopCheckUI";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { useAuthState } from "./AuthProvider";

type Props = { targetType: "team" | "player" | "league" | "fan"; targetId: string; variant?: "default" | "club"; showCount?: boolean; showNotifications?: boolean; onCountChange?: (count: number) => void };

export default function FollowButton({ targetType, targetId, variant = "default", showCount = true, showNotifications = true, onCountChange }: Props) {
  const { formatNumber, t } = useLanguage();
  const { userId, signedIn, ready: authReady } = useAuthState();
  const [following, setFollowing] = useState(false);
  const [notify, setNotify] = useState(true);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!authReady) return () => { mounted = false; };
    const followPromise = userId
      ? supabase.from("follow_relationships")
          .select("notify_reviews,notify_ratings,notify_updates")
          .eq("follower_id", userId)
          .eq("target_type", targetType)
          .eq("target_id", targetId)
          .maybeSingle()
      : Promise.resolve({ data: null });
    if (!userId) setFollowing(false);
    void Promise.all([
      followPromise,
      supabase.rpc("get_follow_count", { p_target_type: targetType, p_target_id: targetId }),
    ]).then(([followResult, countResult]) => {
      if (!mounted) return;
      const nextCount = Number(countResult.data ?? 0);
      setCount(nextCount);
      onCountChange?.(nextCount);
      setFollowing(Boolean(followResult.data));
      if (followResult.data) {
        setNotify(Boolean(followResult.data.notify_reviews || followResult.data.notify_ratings || followResult.data.notify_updates));
      }
    });
    return () => { mounted = false; };
  }, [targetType, targetId, userId, authReady]);  async function toggle() {
    if (!authReady || !userId) {
      window.location.href = "/login";
      return;
    }
    const user = { id: userId };
    setBusy(true);
    const wasFollowing = following;
    const previousCount = count;
    setFollowing(!wasFollowing);
    const nextCount = Math.max(0, count + (wasFollowing ? -1 : 1));
    setCount(nextCount);
    onCountChange?.(nextCount);
    if (wasFollowing) {
      const { error } = await supabase.from("follow_relationships").delete()
        .eq("follower_id", user.id).eq("target_type", targetType).eq("target_id", targetId);
      if (error) {
        setFollowing(wasFollowing);
        setCount(previousCount);
        onCountChange?.(previousCount);
      }
    } else {
      const { error } = await supabase.from("follow_relationships").insert({
        follower_id: user.id,
        target_type: targetType,
        target_id: targetId,
        notify_reviews: true,
        notify_ratings: true,
        notify_updates: true,
      });
      if (error) {
        setFollowing(wasFollowing);
        setCount(previousCount);
        onCountChange?.(previousCount);
      } else {
        setNotify(true);
      }
    }
    setBusy(false);
  }
