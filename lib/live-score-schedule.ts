/**
 * Free-tier provider request allocator for the existing GitHub Actions sync.
 *
 * GitHub schedules four invocations an hour (:07, :22, :37, :52 UTC).
 * Every invocation still fetches exactly ONE provider date. Rotating one
 * slot every three Baku hours gives future fixtures time to populate,
 * while 88 of 96 daily calls remain dedicated to today's game scores.
 *
 * Slots at 00:07, 03:07, ... 18:07 Baku request days +1..+7.
 * The 21:07 slot rechecks yesterday for late or corrected final results.
 * GitHub may delay/drop schedules: these are best-effort, never a claim
 * of guaranteed real-time provider updates.
 */
export type FixtureSyncDay = { date: string; dayOffset: number };

export function selectFixtureSyncDay(now: Date = new Date()): FixtureSyncDay {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid sync time");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const value = (key: string) => Number(parts.find(part => part.type === key)?.value);
  const year = value("year"), month = value("month"), day = value("day");
  const hour = value("hour"), minute = value("minute");
  if (![year, month, day, hour, minute].every(Number.isSafeInteger)
      || month < 1 || month > 12 || day < 1 || day > 31
      || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("Invalid Baku date");
  }
  const slot = hour * 4 + Math.floor(minute / 15); // 0..95
  const rotation = slot % 12 === 0 ? slot / 12 : -1;
  const dayOffset = rotation < 0 ? 0 : rotation === 7 ? -1 : rotation + 1;
  const date = new Date(Date.UTC(year, month - 1, day + dayOffset)).toISOString().slice(0, 10);
  return { date, dayOffset };
}
