import type { ReactNode } from "react";
import TeamLogo from "./TeamLogo";
import { countryFlag } from "../lib/countryFlag";
import "../app/hoopcheck-brand-team.css";

type LeagueProfileHeroProps = {
  name: string;
  country: string | null;
  level: string | null;
  logoUrl?: string | null;
  countryFallback: string;
  children: ReactNode;
};

export default function LeagueProfileHero({
  name,
  country,
  level,
  logoUrl,
  countryFallback,
  children,
}: LeagueProfileHeroProps) {
  const flag = countryFlag(country);
  return (
    <section className="hc-league-look-hero" aria-labelledby="league-profile-title">
      <TeamLogo name={name} logoUrl={logoUrl} size={72} />
      <div className="hc-league-look-hero-copy">
        <p className="hc-team-hero-kicker">League profile</p>
        <h1 id="league-profile-title">{name}</h1>
        <p className="hc-team-hero-location">
          {flag && <span aria-hidden="true">{flag} </span>}
          {country || countryFallback}
          {level && <> · {level}</>}
        </p>
        {children}
      </div>
    </section>
  );
}
