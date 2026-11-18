/** NATIVE-2 data contracts only. No production writes or permission changes. */
export type Native2Feature = "arenaCheckIn" | "travelMode" | "highlightCamera" | "verificationVideo";
export const NATIVE2_ENABLED: Readonly<Record<Native2Feature, boolean>> = {
  arenaCheckIn: false,
  travelMode: false,
  highlightCamera: false,
  verificationVideo: false,
};
export type ArenaCheckIn = {
  id: string;
  userId: string;
  gameId: string;
  venueId: string;
  checkedInAt: string;
  status: "pending" | "verified" | "rejected";
};
export type TravelPreferences = {
  enabled: boolean;
  locationConsent: boolean;
  countryCode: string | null;
  mode: "manual" | "foreground";
};
export type HighlightClip = {
  id: string;
  ownerId: string;
  storagePath: string;
  status: "local" | "processing" | "ready" | "failed";
  watermarkApplied: boolean;
  endCardApplied: boolean;
};
export type VerificationVideoSubmission = {
  requestId: string;
  ownerId: string;
  privateStoragePath: string;
  status: "pending" | "approved" | "rejected";
};
/** Attendance never overrides existing chat availability, membership or moderation gates. */
export function canUseAttendanceChatUnlock(
  verifiedAttendance: boolean,
  chatWindowOpen: boolean,
  existingAuthorization: boolean,
): boolean {
  return verifiedAttendance && chatWindowOpen && existingAuthorization;
}
/** A video must be fully branded before it is eligible for export. */
export function canExportHighlight(clip: HighlightClip): boolean {
  return clip.status === "ready" && clip.watermarkApplied && clip.endCardApplied;
}
