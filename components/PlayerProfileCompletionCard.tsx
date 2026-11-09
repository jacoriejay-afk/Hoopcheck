"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getPlayerProfileCompletion, type PlayerProfileCompletionRecord } from "../lib/player-profile-completion";
import { supabase } from "../lib/supabase";
import { HoopIcon } from "./HoopCheckUI";

export default function PlayerProfileCompletionCard({ profile, onPublished }: { profile: PlayerProfileCompletionRecord; onPublished?: () => void }) {
  const [currentProfile, setCurrentProfile] = useState(profile);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const refreshProfile = useCallback(async () => {
    if (!profile.id) return;
    const { data, error: readError } = await supabase.from("profiles")
      .select("id,account_type,avatar_url,position,current_team,free_agent,current_country,favorite_leagues,height,bio,hometown,profile_visibility")
      .eq("id", profile.id).maybeSingle();
    if (!readError && data) setCurrentProfile(current => ({ ...current, ...data }));
  }, [profile.id]);

  useEffect(() => {
    void refreshProfile();
    const onFocus = () => { void refreshProfile(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshProfile();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshProfile]);

  const completion = getPlayerProfileCompletion(currentProfile);
  const complete = completion.percentage === 100;
  const publicProfileHref = currentProfile.id ? "/players/" + encodeURIComponent(currentProfile.id) : "/profile";
  const isPublic = currentProfile.profile_visibility === "public";

  async function makePublic() {
    if (!currentProfile.id || publishing) return;
    setPublishing(true);
    setError("");
    try {
      const { data, error: updateError } = await supabase.from("profiles")
        .update({ profile_visibility: "public" })
        .eq("id", currentProfile.id)
        .select("id,account_type,avatar_url,position,current_team,free_agent,current_country,favorite_leagues,height,bio,hometown,profile_visibility")
        .maybeSingle();
      if (updateError || !data) throw updateError || new Error("Your profile could not be made public. Please try again.");
      setCurrentProfile(current => ({ ...current, ...data }));
      onPublished?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your profile could not be made public. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  if (currentProfile.account_type !== "player") return null;

  return (
    <section className="hc-ux2b-completion-card" aria-label="Player profile completion">
      <div className="hc-ux2b-completion-heading">
        <div>
          <p className="eyebrow">{complete ? "PROFILE COMPLETE" : "BUILD YOUR PLAYER PROFILE"}</p>
          <strong>{complete ? "Your player profile is complete." : completion.percentage + "% complete"}</strong>
          <p className="muted">{complete ? "Your profile has all seven key details." : completion.completed + " of " + completion.total + " profile details completed."}</p>
        </div>
        <span className="hc-ux2b-completion-percent">{completion.percentage}%</span>
      </div>
      <div className="hc-ux2b-progress" role="progressbar" aria-label="Player profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion.percentage}>
        <span style={{ width: completion.percentage + "%" }} />
      </div>
      {complete ? (
        <div className="hc-ux2b-completion-actions">
          {isPublic ? (
            <Link href={publicProfileHref} className="btn">View Public Profile <HoopIcon name="arrow-up-right" size={16} /></Link>
          ) : (
            <button type="button" className="btn" disabled={publishing || !currentProfile.id} onClick={() => void makePublic()}>
              {publishing ? "Publishing..." : "Make Public"} <HoopIcon name="arrow-right" size={16} />
            </button>
          )}
        </div>
      ) : (
        <Link href="/complete-profile" className="hc-ux2b-completion-continue">
          Complete profile <span>Continue <HoopIcon name="arrow-right" size={16} /></span>
        </Link>
      )}
      {error && <p className="hc-ux2b-error" role="alert">{error}</p>}
    </section>
  );
}
