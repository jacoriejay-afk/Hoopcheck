import { canExportHighlight, canUseAttendanceChatUnlock, type HighlightClip } from "./contracts";

export type CheckInEvidence = {
  gameId: string;
  venueId: string;
  gameVenueId: string;
  metersFromVenue: number;
  accuracyMeters: number;
  withinGameWindow: boolean;
  permissionGranted: boolean;
};

/** UI preflight only. Server must independently validate authenticated location evidence. */
export function checkInPreflight(e: CheckInEvidence): boolean {
  return Boolean(e.gameId && e.venueId && e.venueId === e.gameVenueId)
    && e.permissionGranted && e.withinGameWindow
    && Number.isFinite(e.metersFromVenue) && e.metersFromVenue >= 0
    && Number.isFinite(e.accuracyMeters) && e.accuracyMeters >= 0
    && e.metersFromVenue <= 250 && e.accuracyMeters <= 100;
}

export function normalizeCountryCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function mayOpenAttendanceChat(attendanceVerified: boolean, chatWindowOpen: boolean, authorized: boolean) {
  return canUseAttendanceChatUnlock(attendanceVerified, chatWindowOpen, authorized);
}

export function mayPublishHighlight(clip: HighlightClip, entitled: boolean, moderationAllowed: boolean) {
  return entitled && moderationAllowed && canExportHighlight(clip);
}
