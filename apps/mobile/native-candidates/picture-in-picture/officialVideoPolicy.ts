/** Only bundled, separately reviewed public HoopCheck-owned videos may enter PiP.
 * Never use a provider URL, protected media token, feed/reel, arbitrary user URI,
 * or a caller-supplied asset object as a playback source.
 */
export type ReviewedOfficialVideo = Readonly<{
  asset: number;
  rights: "hoopcheck-owned-public-pip";
  evidence: string;
}>;
export type OfficialCatalog = Readonly<Record<string, ReviewedOfficialVideo | undefined>>;
// Intentionally empty: no release-approved instructional video asset was found.
export const officialCatalog: OfficialCatalog = Object.freeze({});
export function reviewedOfficialAsset(catalog: OfficialCatalog, id: unknown, enabled: boolean, activeSession: boolean, supportedDevice: boolean): number | null {
  if (enabled !== true || activeSession !== true || supportedDevice !== true || typeof id !== "string" ||
      !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) || !Object.prototype.hasOwnProperty.call(catalog,id)) return null;
  const item = catalog[id];
  return item?.rights === "hoopcheck-owned-public-pip" &&
    typeof item.evidence === "string" && item.evidence.trim().length > 0 &&
    Number.isSafeInteger(item.asset) && item.asset > 0 ? item.asset : null;
}
