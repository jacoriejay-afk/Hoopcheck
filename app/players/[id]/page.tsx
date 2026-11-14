"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HoopLoading from "../../../components/HoopLoading";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import FollowButton from "../../../components/FollowButton";
import PlayerContactButton from "../../../components/PlayerContactButton";
import Surface from "../../../components/Surface";
import { VerifiedBadge } from "../../../components/HoopCheckUI";
import PlayerJourney from "../../../components/PlayerJourney";
import PlayerProfileCompletionCard from "../../../components/PlayerProfileCompletionCard";
import { getHoopCheckEntitlements } from "../../../lib/membership-tier";
import type { PlayerProfileCompletionRecord } from "../../../lib/player-profile-completion";

type Player = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  bio: string | null;
  player_position: string | null;
  years_pro: number | null;
  current_country: string | null;
  current_country_public?: boolean;
  current_team: string | null;
  player_verified: boolean;
  player_verified_at: string | null;
};

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportMessage, setReportMessage] = useState("");
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [ownCompletionProfile, setOwnCompletionProfile] = useState<PlayerProfileCompletionRecord | null>(null);
  const [countryPublic, setCountryPublic] = useState(false);
  const [canManageJourney, setCanManageJourney] = useState(false);
  const [viewerType, setViewerType] = useState("");
  const [connectionAccepted, setConnectionAccepted] = useState(false);
  const [followers, setFollowers] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const {data:{session}}=await supabase.auth.getSession();
      const user=session?.user;
      let currentViewerType = "";
      if(user){
        const {data:viewerProfile,error:viewerError}=await supabase.from("profiles").select("account_type").eq("id",user.id).maybeSingle();
        if(viewerError || !viewerProfile || viewerProfile.account_type==="fan"){window.location.replace("/dashboard");return;}
        currentViewerType = viewerProfile.account_type || "";
        setViewerType(currentViewerType);
      }

      const { data, error } = await supabase
        .rpc("get_public_player_profile", { p_user_id: params.id });

      if (!error && data?.[0]) {
        setPlayer(data[0]);
        const { data: countryVisibility } = await supabase.rpc("is_player_country_public", { p_user_id: params.id });
        setCountryPublic(countryVisibility === true);
        setLoading(false);
      } else if (user?.id === params.id) {
        // Owners can always open their own player profile, even if they keep it private.
        const { data: own } = await supabase
          .from("profiles")
          .select("id,display_name,avatar_url,country,bio,position,years_pro,current_country,current_country_public,current_team,player_verified,player_verified_at,account_type")
          .eq("id", params.id)
          .eq("account_type", "player")
          .maybeSingle();
        if (own) {
          setCountryPublic(Boolean(own.current_country_public));
          setPlayer({
            id: own.id,
            display_name: own.display_name,
            avatar_url: own.avatar_url,
            country: own.country,
            bio: own.bio,
            player_position: own.position,
            years_pro: own.years_pro,
            current_country: own.current_country,
            current_country_public: own.current_country_public,
            current_team: own.current_team,
            player_verified: Boolean(own.player_verified),
            player_verified_at: own.player_verified_at,
          });
          setLoading(false);
        }
      }

      if(user){
        setIsOwnProfile(user.id===params.id);
        if (user.id === params.id) {
          const [{ data: ownProfile }, { data: ownSubscription }, { data: count }] = await Promise.all([
            supabase.from("profiles").select("id,account_type,avatar_url,position,current_team,free_agent,current_country,favorite_leagues,height,bio,hometown,profile_visibility").eq("id", user.id).maybeSingle(),
            supabase.from("subscriptions").select("plan,status,access_status,current_period_end").eq("user_id", user.id).maybeSingle(),
            supabase.rpc("get_follow_count", { p_target_type: "player", p_target_id: user.id }),
          ]);
          setFollowers(count === null ? null : Number(count));
          setOwnCompletionProfile(ownProfile as PlayerProfileCompletionRecord | null);
          const entitlements = getHoopCheckEntitlements({ accountType: ownProfile?.account_type, subscription: ownSubscription });
          setCanManageJourney(entitlements.canUseProPassport);
        }
        if(user.id!==params.id && currentViewerType==="player"){
          const {data:r}=await supabase.from("player_contact_requests").select("id").eq("player_id",params.id).eq("requester_id",user.id).eq("status","accepted").maybeSingle();
          setConnectionAccepted(!!r);
        }
      }
      setLoading(false);
    }

    if (params.id) load();
  }, [params.id]);


  async function reportProfile(){
    const reason=window.prompt("Why are you reporting this profile?");
    if(!reason?.trim()) return;
    const {data:{session}}=await supabase.auth.getSession();
    if(!session) { window.location.href="/login"; return; }
    const res=await fetch("/api/profile-reports",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({profileId:player?.id,reason})});
    const body=await res.json().catch(()=>({})); setReportMessage(res.ok?"Report submitted for review.":(body.error||"Unable to submit report."));
  }

  if (loading) {
    return <main className="page-shell"><div className="page-container"><HoopLoading label="Loading player profile..." /></div></main>;
  }

  if (!player) {
    return (
      <main className="page-shell">
        <div className="page-container">
          <section className="hero-card">
            <div>
              <p className="eyebrow">PLAYER PROFILE</p>
              <h1>Profile unavailable</h1>
              <p className="muted">This player profile is private or does not exist.</p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell player-profile-page">
      <div className="page-container">
        <Surface as="section" className="hc-player-profile-identity" aria-label="Player profile">
          <div className="hc-player-profile-portrait">
            {player.avatar_url ? <img src={player.avatar_url} alt="" /> : (player.display_name?.trim().charAt(0).toUpperCase() || "P")}
          </div>
          <div className="hc-player-profile-name">
            <h1>{player.display_name || "HoopCheck Player"}</h1>
            {player.player_verified && <p><VerifiedBadge label="Verified professional player" /> Verified player</p>}
            <p>{[player.player_position, player.current_team, (isOwnProfile || countryPublic) && player.current_country].filter(Boolean).join(" · ")}</p>
            {isOwnProfile && followers !== null && <Link href={`/connections?mode=followers&type=player&id=${player.id}`}>
              {followers.toLocaleString()} {followers === 1 ? "follower" : "followers"}
            </Link>}
          </div>
          <div className="hc-player-profile-controls">
            {isOwnProfile ? <Link href="/account#profile-editor" className="btn">Edit profile</Link>
              : <><FollowButton targetType="player" targetId={player.id} showCount={false} showNotifications={false} />
                <PlayerContactButton playerId={player.id} /></>}
          </div>
        </Surface>
        {isOwnProfile && ownCompletionProfile && <PlayerProfileCompletionCard profile={ownCompletionProfile} />}

        {viewerType === "player" && !isOwnProfile && !connectionAccepted ? (
          <Surface as="section" className="hc-player-profile-detail">
            <h2>Player connection required</h2>
            <p>Connect with this player to view their career profile.</p>
          </Surface>
        ) : (
          <>
            {(player.bio || player.years_pro != null || player.country) && <Surface as="section" className="hc-player-profile-detail">
              <h2>About</h2>
              {(player.years_pro != null || player.country) && <dl>
                {player.years_pro != null && <div><dt>Seasons pro</dt><dd>{player.years_pro}</dd></div>}
                {player.country && <div><dt>Country</dt><dd>{player.country}</dd></div>}
              </dl>}
              {player.bio && <p>{player.bio}</p>}
            </Surface>}
            <PlayerJourney playerId={player.id} isOwnProfile={isOwnProfile} canManage={isOwnProfile && canManageJourney} />
          </>
        )}
        {!isOwnProfile && <footer className="hc-player-profile-footer">
          <Link href="/players">Browse players</Link>
          <button type="button" onClick={reportProfile}>Report profile</button>
          {reportMessage && <p role="status">{reportMessage}</p>}
        </footer>}
      </div>
    </main>
  );
}
