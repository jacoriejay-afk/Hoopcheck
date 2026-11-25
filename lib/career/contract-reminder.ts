export const reminderLeadDays = [7, 14, 30] as const;
export type ReminderLead = typeof reminderLeadDays[number];

function parseDay(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Enter a valid contract end date.");
  const time = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0,10) !== value || Number(value.slice(0,4)) < 1900) throw new Error("Enter a valid contract end date.");
  return time;
}
const day = 86400000;
const icalDay = (time: number) => new Date(time).toISOString().slice(0,10).replace(/-/g,"");

/** Generic all-day calendar reminder; never contains identity, salary, team or private contract text. */
export function contractReminderCalendar(endDate: string, lead: ReminderLead, uid: string, now = new Date()): string {
  if (!reminderLeadDays.includes(lead) || !/^[0-9a-f-]{36}$/i.test(uid) || !Number.isFinite(now.getTime())) throw new Error("Invalid reminder.");
  const end = parseDay(endDate);
  // Compare calendar dates, not hours or DST-dependent elapsed days.
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const reminder = end - lead * day;
  if (reminder < today) throw new Error("Choose a future reminder date or shorter notice period.");
  if (new Date(end + day).getUTCFullYear() > 9999) throw new Error("Contract date is out of range.");
  const stamp = now.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
  return [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//HoopCheck//Contract reminder//EN","CALSCALE:GREGORIAN",
    "BEGIN:VEVENT","UID:"+uid+"@hoopcheck.online","DTSTAMP:"+stamp,
    "DTSTART;VALUE=DATE:"+icalDay(end),"DTEND;VALUE=DATE:"+icalDay(end+day),
    "SUMMARY:Contract expiration","DESCRIPTION:Review your contract before its entered end date.","CLASS:PRIVATE","TRANSP:TRANSPARENT",
    "BEGIN:VALARM","TRIGGER:-P"+lead+"D","ACTION:DISPLAY","DESCRIPTION:Review your contract","END:VALARM",
    "END:VEVENT","END:VCALENDAR",""
  ].join("\r\n");
}
