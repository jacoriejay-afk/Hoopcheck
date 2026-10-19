"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type TeamMapItem = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  league_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  trustScore?: number | null;
  averageRating?: number | null;
};

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  "United States":[39.5,-98.35],Canada:[56.1,-106.3],Mexico:[23.6,-102.5],
  Spain:[40.4,-3.7],France:[46.2,2.2],Germany:[51.2,10.4],Italy:[41.9,12.5],
  Greece:[39.1,21.8],Türkiye:[39,35],Turkey:[39,35],Serbia:[44,21],Croatia:[45.1,15.2],
  "Bosnia and Herzegovina":[44.2,17.7],Kosovo:[42.6,20.9],Albania:[41.2,20.2],
  Portugal:[39.4,-8.2],Poland:[52.1,19.1],Lithuania:[55.2,23.9],Latvia:[56.9,24.6],
  Estonia:[58.6,25],Finland:[64,26],Sweden:[60.1,18.6],Norway:[60.5,8.5],
  Denmark:[56,9.5],Belgium:[50.5,4.5],Netherlands:[52.1,5.3],Austria:[47.5,14.6],
  Switzerland:[46.8,8.2],Romania:[45.9,24.9],Bulgaria:[42.7,25.5],Hungary:[47.2,19.5],
  Czechia:[49.8,15.5],"Czech Republic":[49.8,15.5],Slovakia:[48.7,19.7],Ukraine:[48.4,31.2],
  Russia:[61.5,105.3],Azerbaijan:[40.1,47.6],Georgia:[42.3,43.4],Israel:[31.5,34.8],
  Lebanon:[33.9,35.9],Jordan:[31.2,36.2],China:[35.9,104.2],Japan:[36.2,138.3],
  "South Korea":[36.5,127.9],Philippines:[12.9,121.8],Mongolia:[46.9,103.8],
  Australia:[-25.3,133.8],"New Zealand":[-40.9,174.9],Argentina:[-38.4,-63.6],
  Brazil:[-10.8,-52.9],Chile:[-35.7,-71.5],Colombia:[4.6,-74.1],Uruguay:[-32.5,-55.8],
  Egypt:[26.8,30.8],Tunisia:[33.9,9.5],Morocco:[31.8,-7.1],Nigeria:[9.1,8.7],
  "South Africa":[-30.6,22.9]
};

function locationFor(team: TeamMapItem) {
  const lat = Number(team.latitude);
  const lon = Number(team.longitude);
  if (team.latitude != null && team.longitude != null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    return { lat, lon, approximate: false };
  }
  const fallback = team.country ? COUNTRY_CENTROIDS[team.country] : undefined;
  return fallback ? { lat: fallback[0], lon: fallback[1], approximate: true } : null;
}

export default function TeamMap({ teams }: { teams: TeamMapItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapped = useMemo(() => teams.map(team => ({ team, location: locationFor(team) })).filter((item): item is {team:TeamMapItem;location:{lat:number;lon:number;approximate:boolean}} => Boolean(item.location)), [teams]);
  const selected = mapped.find(item => item.team.id === selectedId) || null;

  return (
    <div className="hc-world-map" aria-label="World map of professional basketball teams">
      <svg className="hc-world-map__svg" viewBox="0 0 1000 500" role="img" aria-label="Stylized dark world map with basketball court markings">
        <defs>
          <pattern id="hc-map-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M50 0H0V50" fill="none" stroke="#282828" strokeWidth="1" />
          </pattern>
          <linearGradient id="hc-map-glow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1d1d1d" />
            <stop offset="100%" stopColor="#101010" />
          </linearGradient>
        </defs>
        <rect width="1000" height="500" fill="url(#hc-map-glow)" />
        <rect width="1000" height="500" fill="url(#hc-map-grid)" opacity=".55" />
        <g fill="#202020" stroke="#383838" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M83 91 125 57 186 51 219 70 251 67 282 95 273 119 238 131 225 162 191 177 174 213 145 207 130 178 103 161 91 128 68 117Z" />
          <path d="M219 178 242 195 250 229 271 253 263 292 244 329 233 376 213 414 197 379 196 341 177 308 181 270 164 235 178 205Z" />
          <path d="M422 100 446 80 479 87 489 107 472 122 452 118Z" />
          <path d="M440 131 472 123 505 144 521 181 507 226 483 267 459 284 442 251 430 212 418 172Z" />
          <path d="M484 88 526 61 583 57 618 74 664 64 714 86 764 89 811 111 840 143 817 162 782 153 757 175 720 172 699 194 670 182 648 159 620 163 592 143 559 152 536 126 506 122Z" />
          <path d="M591 171 618 179 641 211 633 250 612 277 597 253 586 216Z" />
          <path d="M713 253 748 240 785 252 803 276 783 299 752 305 725 287Z" />
          <path d="M825 333 855 324 879 339 873 359 844 367 823 352Z" />
          <path d="M889 130 905 122 922 139 912 159 895 153Z" />
        </g>
        <g fill="none" stroke="#ff5a1f" strokeOpacity=".18" strokeWidth="1.3">
          <circle cx="500" cy="250" r="130" />
          <circle cx="500" cy="250" r="180" strokeDasharray="5 9" />
          <path d="M0 250H1000M500 0V500" />
        </g>
      </svg>
      {mapped.map(({team,location}) => {
        const x = 4 + ((location.lon + 180) / 360) * 92;
        const y = 6 + ((90 - location.lat) / 180) * 88;
        return <button key={team.id} type="button" className={`hc-world-map__dot ${selectedId === team.id ? "is-selected" : ""}`}
          style={{ left: `${x}%`, top: `${y}%` }} onClick={() => setSelectedId(team.id)}
          aria-label={`Show ${team.name} in ${team.country || "its country"}`} title={team.name}>
          <span />
        </button>;
      })}
      <div className="hc-world-map__legend"><span /> TEAM LOCATIONS <small>{mapped.length} mapped</small></div>
      {selected && <aside className="hc-world-map__popup">
        <button type="button" className="hc-world-map__close" onClick={() => setSelectedId(null)} aria-label="Close team card">×</button>
        <p className="eyebrow">TEAM SCOUTING CARD</p>
        <h3>{selected.team.name}</h3>
        <p>{selected.team.league_name || "League not listed"}{selected.team.country ? ` · ${selected.team.country}` : ""}</p>
        <div className="hc-world-map__rating"><span>Rating</span><strong>{selected.team.averageRating == null ? "—" : selected.team.averageRating.toFixed(1) + " / 5"}</strong></div>
        {selected.location.approximate && <small>Approximate country placement</small>}
        <Link href={`/teams/${selected.team.id}`} className="hc-world-map__open">Open team profile →</Link>
      </aside>}
      {!mapped.length && <div className="hc-world-map__empty"><strong>Global team map</strong><span>Team dots appear as location data is available.</span></div>}
    </div>
  );
}
