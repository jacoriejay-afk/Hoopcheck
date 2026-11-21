import type { PlayerProfile } from "./playerProfiles";
export type Passport = { name: string; position: string | null; team: string | null; years: number | null; verified: boolean };
/** Explicit owner-only export allowlist. Location, bio, IDs, avatar and private career stops never enter the document. */
export function passportFields(player: PlayerProfile, owner: string): Passport {
  if (!owner || owner !== player.id) throw Error("Only your own Player Passport can be exported.");
  return { name: player.display_name?.slice(0, 100) || "HoopCheck player", position: player.position?.slice(0, 30) || null, team: player.current_team?.slice(0, 160) || null, years: player.years_pro, verified: player.player_verified === true };
}
export const escapePassport = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
export function passportHtml(pass: Passport) {
  const e = escapePassport;
  const detail = [pass.position, pass.team].filter(Boolean).map(value => e(value!)).join(" · ");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>@page{margin:32px}body{font-family:-apple-system,Arial,sans-serif;color:#f7f7f5;background:#fff;margin:0}.card{background:#171717;border-top:8px solid #ff5a1f;border-radius:24px;padding:36px;min-height:320px;overflow-wrap:anywhere}.eyebrow{font-size:12px;letter-spacing:2px;color:#ff8a5c}h1{font-size:40px;line-height:1.1;margin:32px 0 16px}p{line-height:1.6;color:#bdbdbd}.footer{font-size:11px;color:#535353;margin-top:24px}</style></head><body><div class="card"><div class="eyebrow">HOOPCHECK · PLAYER PASSPORT</div><h1>${e(pass.name)}</h1><p>${detail}</p><p>${pass.years === null ? "Professional experience not listed" : `${pass.years} ${pass.years === 1 ? "year" : "years"} pro · profile reported`}</p><p>${pass.verified ? "Verified professional player on HoopCheck" : "HoopCheck player profile"}</p></div><div class="footer">Shared by the player. This card reflects profile information and is not an identity document or independent verification of playing history. hoopcheck.online</div></body></html>`;
}
