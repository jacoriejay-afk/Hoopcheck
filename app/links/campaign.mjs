// Only first-party campaign labels are propagated; never forward arbitrary query values or referral tokens.
const sources = new Set(["instagram", "tiktok", "facebook", "youtube", "x", "linkedin"]);
export function signupLink(source) {
  const safe = typeof source === "string" && sources.has(source) ? source : "hoopcheck";
  return "/signup?" + new URLSearchParams({ utm_source: safe, utm_medium: "link_in_bio", utm_campaign: "hoopcheck_links" }).toString();
}
