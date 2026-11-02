"use client";

import Link from "next/link";
import { getPlayerProfileCompletion, type PlayerProfileCompletionRecord } from "../lib/player-profile-completion";
import { HoopIcon } from "./HoopCheckUI";

export default function PlayerProfileCompletionCard({ profile }: { profile: PlayerProfileCompletionRecord }) {
  if (profile.account_type !== "player") return null;
  const completion = getPlayerProfileCompletion(profile);
  const complete = completion.percentage === 100;
  const publicProfileHref = profile.id ? "/players/" + encodeURIComponent(profile.id) : "/profile";

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
          {profile.profile_visibility === "public" ? (
            <Link href={publicProfileHref} className="btn">View Public Profile <HoopIcon name="arrow-up-right" size={16} /></Link>
          ) : (
            <Link href="/complete-profile?makePublic=1" className="btn">Make Public <HoopIcon name="arrow-right" size={16} /></Link>
          )}
        </div>
      ) : (
        <Link href="/complete-profile" className="hc-ux2b-completion-continue">
          Complete profile <span>Continue <HoopIcon name="arrow-right" size={16} /></span>
        </Link>
      )}
    </section>
  );
}
