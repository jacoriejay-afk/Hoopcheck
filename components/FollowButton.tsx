"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { HoopIcon } from "./HoopCheckUI";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";

type Props = { targetType: "team" | "player" | "league" | "fan"; targetId: string; variant?: "default" | "club"; showCount?: boolean; showNotifications?: boolean; compact?: boolean; onCountChange?: (count: number) => void; controlledFollowing?: boolean; onFollowingChange?: (following: boolean) => void };

export default function FollowButton({ targetType, targetId, variant = "default", showCount = true, showNotifications = true, compact = false, onCountChange, controlledFollowing, onFollowingChange }: Props) {
  const { formatNumber, t } = useLanguage();
  const [ownFollowing, setFollowing] = useState(false);
  const following = controlledFollowing ?? ownFollowing;
  const [notify, setNotify] = useState(true);
  const [count, setCount] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [notice, setNotice] = useState("");
  const userId = useRef<string | null>(null);
  const actionLock = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showFailure() {
    setNotice("Couldn't save that — try again");
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 2600);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!mounted) return;
      userId.current = user?.id ?? null;
      setSignedIn(Boolean(user));
      const followPromise = user && controlledFollowing === undefined
        ? supabase.from("follow_relationships")
            .select("notify_reviews,notify_ratings,notify_updates")
            .eq("follower_id", user.id)
            .eq("target_type", targetType)
            .eq("target_id", targetId)
            .maybeSingle()
        : Promise.resolve({ data: null });
      const [followResult, countResult] = await Promise.all([
        followPromise,
        showCount || onCountChange ? supabase.rpc("get_follow_count", { p_target_type: targetType, p_target_id: targetId }) : Promise.resolve({ data: null }),
      ]);
      if (!mounted) return;
      const nextCount = Number(countResult.data ?? 0);
      setCount(nextCount);
      onCountChange?.(nextCount);
      if (followResult.data) {
        setFollowing(true);
        setNotify(Boolean(followResult.data.notify_reviews || followResult.data.notify_ratings || followResult.data.notify_updates));
      } else {
        setFollowing(false);
      }
    })();
    return () => {
      mounted = false;
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [targetType, targetId, onCountChange, showCount, controlledFollowing]);

  async function toggle() {
    if (actionLock.current) return;
    const id = userId.current;
    if (!id) {
      window.location.href = "/login";
      return;
    }
    actionLock.current = true;
    const wasFollowing = following;
    const previousCount = count;
    const nextFollowing = !wasFollowing;
    const nextCount = Math.max(0, previousCount + (nextFollowing ? 1 : -1));

    // Commit the visual response before awaiting the network.
    setFollowing(nextFollowing);
    setCount(nextCount);
    onCountChange?.(nextCount);
    setNotice("");

    try {
      const result = nextFollowing
        ? await supabase.from("follow_relationships").insert({
            follower_id: id,
            target_type: targetType,
            target_id: targetId,
            notify_reviews: true,
            notify_ratings: true,
            notify_updates: true,
          })
        : await supabase.from("follow_relationships").delete()
            .eq("follower_id", id).eq("target_type", targetType).eq("target_id", targetId);

      if (result.error) {
        setFollowing(wasFollowing);
        setCount(previousCount);
        onCountChange?.(previousCount);
        showFailure();
      } else {
        onFollowingChange?.(nextFollowing);
        if (nextFollowing) setNotify(true);
        if (!showCount && !onCountChange) return;
        const { data: reconciledCount } = await supabase.rpc("get_follow_count", { p_target_type: targetType, p_target_id: targetId });
        if (reconciledCount !== null && reconciledCount !== undefined) {
          const value = Number(reconciledCount);
          setCount(value);
          onCountChange?.(value);
        }
      }
    } catch {
      setFollowing(wasFollowing);
      setCount(previousCount);
      onCountChange?.(previousCount);
      showFailure();
    } finally {
      actionLock.current = false;
    }
  }

  async function toggleNotify() {
    if (actionLock.current || !userId.current || !following) return;
    actionLock.current = true;
    const previous = notify;
    const next = !previous;
    setNotify(next);
    try {
      const { error } = await supabase.from("follow_relationships").update({
        notify_reviews: next,
        notify_ratings: next,
        notify_updates: next,
      }).eq("follower_id", userId.current).eq("target_type", targetType).eq("target_id", targetId);
      if (error) { setNotify(previous); showFailure(); }
    } catch {
      setNotify(previous);
      showFailure();
    } finally {
      actionLock.current = false;
    }
  }

  return (
    <div className={compact ? "hc-follow-compact" : undefined} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className={variant === "club" ? `hc-team-follow-pill ${following ? "is-following" : "is-not-following"}` : "btn dark"}
        onClick={() => void toggle()}
        title={following ? t("followingProfileTitle") : t("followProfileTitle")}
        aria-pressed={following}
      >
        {following ? <HoopIcon name="check" size={15} /> : <HoopIcon name="user" size={15} />} {following ? t("following") : t("follow")}
      </button>
      {showCount && <Link className="follow-count muted hc-follow-count-link" href={"/connections?mode=followers&type=" + encodeURIComponent(targetType) + "&id=" + encodeURIComponent(targetId)} aria-label={formatNumber(count) + " followers"}>{t("followerCount").replace("{count}", formatNumber(count))}</Link>}
      {showNotifications && <button
        type="button"
        aria-label={t("toggleNotifications")}
        title={following ? t("teamAlerts") : t("followToEnableAlerts")}
        onClick={() => void toggleNotify()}
        disabled={!following}
        style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "transparent", color: "inherit", cursor: following ? "pointer" : "not-allowed", opacity: following ? 1 : 0.55 }}
      >
        <><HoopIcon name="bell" size={15} /> {notify ? t("on") : t("off")}</>
      </button>}
      {!signedIn && !compact && <span className="muted" style={{ fontSize: 12 }}>{t("signInToFollow")}</span>}
      {notice && <span role="status" aria-live="polite" className="hc-action-toast">{notice}</span>}
    </div>
  );
}
