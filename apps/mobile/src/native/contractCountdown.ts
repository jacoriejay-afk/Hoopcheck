/** Date-only countdown: compare local calendar days, not elapsed 24-hour periods. */
export function contractCountdownDays(endDate: string, now: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || Number(endDate.slice(0,4)) < 1900 || !Number.isFinite(now.getTime())) return null;
  const end = Date.parse(endDate + "T00:00:00.000Z");
  if (!Number.isFinite(end) || new Date(end).toISOString().slice(0,10) !== endDate) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end - today) / 86400000);
}
