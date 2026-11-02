"use client";

import { useState } from "react";
import Link from "next/link";
import { getPlayerProfileCompletion, type PlayerProfileCompletionRecord } from "../lib/player-profile-completion";
import { supabase } from "../lib/supabase";
import { HoopIcon } from "./HoopCheckUI";

export default function PlayerProfileCompletionCard({ profile }: { profile: PlayerProfileCompletionRecord }) {
  if (profile.account_type !== "player") return null;
  const completion = getPlayerProfileCompletion(profile);
  const complete = completion.percentage === 100;
  const publicProfileHref = profile.id ? "/players/" + encodeURIComponent(profile.id) : "/profile";
  const [isPublic, setIsPublic] = useState(profile.profile_visibility === "public");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  async function makePublic() {
    if (!profile.id || publishing) return;
    setPublishing(true);
    setError("");
    const { error: updateError } = await supabase.from("profiles")
      .update({ profile_visibility: "public" })
      .eq("id", profile.id);
    if (updateError) setError(updateError.message);
    else setIsPublic(true);
    setPublishing(false);
  }

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
            <button type="button" className="btn" disabled={publishing || !profile.id} onClick={() => void makePublic()}>
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
