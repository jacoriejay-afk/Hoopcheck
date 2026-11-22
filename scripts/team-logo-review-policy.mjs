// Explicit review policy for automated club-logo publishing.
// Directory data and a matching image are not sufficient proof of usage rights.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validExternalHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.hostname.endsWith(".local") && url.hostname !== "localhost" &&
      !/^\d+(?:\.\d+){3}$/.test(url.hostname) && !url.hostname.includes(":");
  } catch { return false; }
}

export function reviewedEntryFor(row, manifest) {
  if (!manifest || !Array.isArray(manifest.entries)) return null;
  const matching = manifest.entries.filter(entry => entry?.table === row.__table && entry?.teamId === row.id);
  // Conflicting reviews must be resolved before publication.
  if (matching.length !== 1) return null;
  const entry = matching[0];
  if (!uuidPattern.test(entry.teamId)) return null;
  if (!["teams", "womens_teams", "leagues"].includes(entry.table)) return null;
  if (entry.teamName !== row.name || entry.country !== (row.country ?? null)) return null;
  if (!["public-domain", "written-permission"].includes(entry.rights)) return null;
  if (entry.approved !== true || typeof entry.reviewedBy !== "string" || entry.reviewedBy.trim().length < 2) return null;
  if (typeof entry.reviewedAt !== "string" || !/^\d{4}-\d\d-\d\d$/.test(entry.reviewedAt) || Number.isNaN(Date.parse(entry.reviewedAt))) return null;
  if (![entry.imageUrl, entry.sourcePage, entry.rightsEvidenceUrl].every(validExternalHttps)) return null;
  // Never copy an unchecked SVG, third-party script, or unrelated image format
  // into a public club-logo bucket; use a reviewed PNG/JPG/WebP asset.
  if (!/\.(png|jpe?g|webp)(?:\?|$)/i.test(new URL(entry.imageUrl).pathname)) return null;
  if (entry.rights === "public-domain" && new URL(entry.rightsEvidenceUrl).hostname !== "commons.wikimedia.org") return null;
  return entry;
}
