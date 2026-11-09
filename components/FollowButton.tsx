"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { HoopIcon } from "./HoopCheckUI";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import { useAuthState } from "./AuthProvider";

type Props = {
  targetType: "team" | "player" | "league" | "fan";
  targetId: string;
  variant?: "default" | "club";
  showCount?: boolean;
  showNotifications?: boolean;
  onCountChange?: (count: number) => void;
};

export default function FollowButton({
  targetType,
  targetId,
  variant = "default",
  showCount = true,
  showNotifications = true,
  onCountChange,
}: Props) {
  const { formatNumber, t } = useLanguage();
  const { userId, signedIn, ready: authReady } = useAuthState();
  const router = useRouter();
  const [following, setFollowing] = useState(false);
  const [notify, setNotify] = useState(true);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const actionLock = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCountChangeRef = useRef(onCountChange);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const showFailure = useCallback(() => {
    setNotice("Couldn't save that — try again");
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 2600);
  }, []);

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
      : Promise.resolve({ data: null, error: null });

    void Promise.all([
      followPromise,
      supabase.rpc("get_follow_count", { p_target_type: targetType, p_target_id: targetId }),
    ]).then(([followResult, countResult]) => {
      if (!mounted) return;
      if (followResult.error) {
        console.error("Unable to load follow state:", followResult.error);
        showFailure();
      } else {
        setFollowing(Boolean(followResult.data));
        if (followResult.data) {
          setNotify(Boolean(followResult.data.notify_reviews || followResult.data.notify_ratings || followResult.data.notify_updates));
        }
      }

      if (countResult.error) {
        console.error("Unable to load follow count:", countResult.error);
        showFailure();
        return;
      }
      const nextCount = Number(countResult.data ?? 0);
      setCount(nextCount);
      onCountChangeRef.current?.(nextCount);
    }).catch((error) => {
      console.error("Unable to load follow information:", error);
      if (mounted) showFailure();
    });

    return () => {
      mounted = false;
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [authReady, showFailure, targetId, targetType, userId]);

  async function toggle() {
    if (!authReady || actionLock.current) return;
    if (!userId) {
      router.push("/login");
      return;
    }

    actionLock.current = true;
    setBusy(true);
    const wasFollowing = following;
    const previousCount = count;
    const nextFollowing = !wasFollowing;
    const nextCount = Math.max(0, previousCount + (nextFollowing ? 1 : -1));
    setFollowing(nextFollowing);
    setCount(nextCount);
    onCountChangeRef.current?.(nextCount);
    setNotice("");

    try {
      const result = nextFollowing
        ? await supabase.from("follow_relationships").insert({
            follower_id: userId,
            target_type: targetType,
            target_id: targetId,
            notify_reviews: true,
            notify_ratings: true,
            notify_updates: true,
          })
        : await supabase.from("follow_relationships").delete()
            .eq("follower_id", userId)
            .eq("target_type", targetType)
            .eq("target_id", targetId);

      if (result.error) {
        console.error("Unable to update follow state:", result.error);
        setFollowing(wasFollowing);
        setCount(previousCount);
        onCountChangeRef.current?.(previousCount);
        showFailure();
        return;
      }

      if (nextFollowing) setNotify(true);
      const { data: reconciledCount, error: countError } = await supabase.rpc(
        "get_follow_count",
        { p_target_type: targetType, p_target_id: targetId },
      );
      if (countError) {
        console.error("Unable to refresh follow count:", countError);
        showFailure();
      } else if (reconciledCount !== null && reconciledCount !== undefined) {
        const value = Number(reconciledCount);
        setCount(value);
        onCountChangeRef.current?.(value);
      }
    } catch (error) {
      console.error("Unable to update follow state:", error);
      setFollowing(wasFollowing);
      setCount(previousCount);
      onCountChangeRef.current?.(previousCount);
      showFailure();
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  async function toggleNotify() {
    if (!authReady || actionLock.current || !userId || !following) return;
    actionLock.current = true;
    setBusy(true);
    const previous = notify;
    const next = !previous;
    setNotify(next);
    try {
      const { error } = await supabase.from("follow_relationships").update({
        notify_reviews: next,
        notify_ratings: next,
        notify_updates: next,
      }).eq("follower_id", userId).eq("target_type", targetType).eq("target_id", targetId);
      if (error) {
        console.error("Unable to update follow notifications:", error);
        setNotify(previous);
        showFailure();
      }
    } catch (error) {
      console.error("Unable to update follow notifications:", error);
      setNotify(previous);
      showFailure();
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className={variant === "club" ? `hc-team-follow-pill ${following ? "is-following" : "is-not-following"}` : "btn dark"}
        onClick={() => void toggle()}
        disabled={busy || !authReady}
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
        disabled={!following || busy || !authReady}
        style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", background: "transparent", color: "inherit", cursor: following ? "pointer" : "not-allowed", opacity: following ? 1 : 0.55 }}
      >
        <><HoopIcon name="bell" size={15} /> {notify ? t("on") : t("off")}</>
      </button>}
      {authReady && !signedIn && <span className="muted" style={{ fontSize: 12 }}>{t("signInToFollow")}</span>}
      {notice && <span role="status" aria-live="polite" className="hc-action-toast">{notice}</span>}
    </div>
  );
}
