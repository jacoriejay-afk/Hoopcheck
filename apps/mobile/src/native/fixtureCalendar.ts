/** RFC 5545 single-fixture export. No guessed end time, no private data or calendar permission. */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const zoned=/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,6})?)?(?:Z|[+-]\d\d:\d\d)$/;
function utc(ms:number){return new Date(ms).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");}
function escapeText(s:string){return s.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,160).replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,");}
function fold(line:string){
  let out="",bytes=0;
  for(const char of line){
    const code=char.codePointAt(0)!;
    const size=code<=0x7f?1:code<=0x7ff?2:code<=0xffff?3:4;
    if(bytes+size>75){out+="\r\n ";bytes=1;}
    out+=char;bytes+=size;
  }
  return out;
}
export function fixtureCalendarFile(input:{id:string;status:string;scheduledAt:string|null;home:string;away:string;side:"mens"|"womens"},now=Date.now()){
  if(!uuid.test(input.id)||input.status!=="scheduled"||!input.scheduledAt||!zoned.test(input.scheduledAt)||!Number.isFinite(now)||!["mens","womens"].includes(input.side))return null;
  const start=Date.parse(input.scheduledAt);
  if(!Number.isFinite(start)||start<=now||start>now+14*86400000)return null;
  const home=escapeText(input.home),away=escapeText(input.away);
  if(!home||!away)return null;
  const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//HoopCheck//Fixture Export//EN","CALSCALE:GREGORIAN","BEGIN:VEVENT",
    "UID:"+input.side+"-"+input.id.toLowerCase()+"@hoopcheck.online","DTSTAMP:"+utc(now),"DTSTART:"+utc(start),
    "SUMMARY:"+home+" vs "+away,"DESCRIPTION:Scheduled tip-off only. End time is not supplied. Recheck HoopCheck for changes before attending.","END:VEVENT","END:VCALENDAR"];
  return lines.map(fold).join("\r\n")+"\r\n";
}
