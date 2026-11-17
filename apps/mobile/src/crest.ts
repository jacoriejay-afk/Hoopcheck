import { tokens } from "./theme";
// Same algorithm as components/TeamLogo.tsx; covered by source-parity checks.
export function crestInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "HC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
export function crestColor(name: string) {
  let hash = 2166136261;
  for (const char of name.toLowerCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return tokens.crest.palette[(hash >>> 0) % tokens.crest.palette.length];
}
