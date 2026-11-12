"use client";

import FollowButton from "./FollowButton";
import TeamLogo from "./TeamLogo";
import { countryFlag } from "../lib/countryFlag";

type TeamProfileHeroProps = {
  teamId: string;
  name: string;
  country?: string | null;
  city?: string | null;
  leagueName?: string | null;
  logoUrl?: string | null;
  logoBg?: "transparent" | "light" | "dark" | null;
  coverUrl?: string | null;
  level?: string | null;
  gender?: "mens" | "womens";
  claimed?: boolean;
  reviewCount: number;
  followerCount: number;
  trustScore?: { score: number | null; explanation?: string; reviewCount?: number; verifiedReviewCount?: number } | null;
  className?: string;
  onFollowerCountChange?: (count: number) => void;
  onOpenFanGroup?: () => void;
};

export default function TeamProfileHero({
  teamId, name, country, city, leagueName, logoUrl, logoBg, coverUrl,
  level, gender = "mens", claimed = false, className = "", onFollowerCountChange, onOpenFanGroup,
}: TeamProfileHeroProps) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  const accent = gender === "womens" ? "#e83e8c" : "#f97316";
  return (
    <section
      className={`hc-team-look-hero ${className}`}
      id="overview"
      aria-labelledby="hc-team-profile-title"
      style={{
        position: "relative", overflow: "hidden", isolation: "isolate",
        borderRadius: 20, padding: "clamp(22px, 5vw, 52px)",
        color: "#fff", background: `linear-gradient(125deg, #111827, ${gender === "womens" ? "#4b1538" : "#54240e"} 65%, #10131a)`,
        minHeight: 280,
      }}
    >
      {coverUrl ? <div aria-hidden="true" style={{position:"absolute",inset:0,zIndex:-2,backgroundImage:`url("${coverUrl.replace(/"/g, "%22")}")`,backgroundSize:"cover",backgroundPosition:"center"}} /> : null}
      <div aria-hidden="true" style={{position:"absolute",inset:0,zIndex:-1,background:"linear-gradient(90deg,rgba(4,8,16,.94),rgba(4,8,16,.72) 65%,rgba(4,8,16,.58))"}} />
      {!coverUrl ? <span aria-hidden="true" style={{position:"absolute",right:-18,bottom:-75,fontSize:"clamp(150px,30vw,320px)",fontWeight:900,opacity:.07,lineHeight:1,pointerEvents:"none"}}>{initials}</span> : null}
      <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
        <div style={{padding:12,borderRadius:20,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)"}}>
          <TeamLogo name={name} logoUrl={logoUrl} logoBg={logoBg} size={88} className="hc-team-profile-logo" />
        </div>
        <div style={{flex:"1 1 220px",minWidth:0}}>
          <p style={{fontSize:11,fontWeight:800,letterSpacing:2,color:"#f9d2b5",marginBottom:8}}>{claimed ? "OFFICIAL CLUB PROFILE" : "CLUB PROFILE"}</p>
          <h1 id="hc-team-profile-title" style={{fontSize:"clamp(30px,5vw,58px)",fontWeight:900,lineHeight:1.05,letterSpacing:"-.035em",color:"#fff",margin:"0 0 12px"}}>{name}{claimed ? <span aria-label="Verified club" title="Verified club" style={{color:accent,marginLeft:10}}>✓</span> : null}</h1>
          <p style={{color:"#e5e7eb",margin:0}}>{countryFlag(country)} {[city,country].filter(Boolean).join(", ") || "Location not listed"}</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:16}}>
            {[gender === "womens" ? "Women's" : "Men's",level,leagueName].filter(Boolean).map(value=><span key={value} style={{fontSize:12,padding:"6px 11px",borderRadius:999,background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.18)",color:"#fff"}}>{value}</span>)}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginTop:24}}>
        <FollowButton targetType="team" targetId={teamId} variant="club" showCount={false} showNotifications={false} onCountChange={onFollowerCountChange} />
        <a href="#fan-hq" onClick={onOpenFanGroup} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"11px 18px",borderRadius:12,background:accent,color:"#fff",fontWeight:800,textDecoration:"none"}}>Join Fan Group</a>
      </div>
    </section>
  );
}
