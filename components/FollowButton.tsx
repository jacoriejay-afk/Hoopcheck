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
  }, [targetType, targetId, userId, authReady]);

  async function toggle() {
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

    async function toggleNotify() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !following) return;
    const next = !notify;
    const { error } = await supabase.from("follow_relationships").update({
      notify_reviews: next,
      notify_ratings: next,
      notify_updates: next,
    }).eq("follower_id", user.id).eq("target_type", targetType).eq("target_id", targetId);
    if (!error) setNotify(next);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className={variant === "club" ? `hc-team-follow-pill ${following ? "is-following" : "is-not-following"}` : "btn dark"}
        onClick={toggle}
        disabled={busy || !authReady}
        title={following ? t("followingProfileTitle") : t("followProfileTitle")}
      >
        {following ? <HoopIcon name="check" size={15} /> : <HoopIcon name="user" size={15} />} {following ? t("following") : t("follow")}
      </button>
      {showCount && <Link className="follow-count muted hc-follow-count-link" href={"/connections?mode=followers&type=" + encodeURIComponent(targetType) + "&id=" + encodeURIComponent(targetId)} aria-label={formatNumber(count) + " followers"}>{t("followerCount").replace("{count}", formatNumber(count))}</Link>}
      {showNotifications && (      <button
          type="button"
          aria-label={t("toggleNotifications")}
          title={following ? t("teamAlerts") : t("followToEnableAlerts")}
          onClick={toggleNotify}
          disabled={!following || busy}
          style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "transparent", color: "inherit", cursor: following ? "pointer" : "not-allowed", opacity: following ? 1 : 0.55 }}
        >
          <><HoopIcon name="bell" size={15} /> {notify ? t("on") : t("off")}</>
        </button>
      )}
      {authReady && !signedIn && <span className="muted" style={{ fontSize: 12 }}>{t("signInToFollow")}</span>}
    </div>
  );
}
