import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {contractReminderCalendar} from '../../../lib/career/contract-reminder.ts';
const uid='11111111-1111-4111-8111-111111111111';
const now=new Date(2026,10,25,12);
test('explicit end date produces a private all-day event and chosen lead alarm',()=>{
 const value=contractReminderCalendar('2027-01-01',14,uid,now);
 for(const line of ['DTSTART;VALUE=DATE:20270101','DTEND;VALUE=DATE:20270102','TRIGGER:-P14D','CLASS:PRIVATE','TRANSP:TRANSPARENT','UID:'+uid+'@hoopcheck.online']) assert.ok(value.includes(line+'\r\n'));
 assert.ok(value.endsWith('END:VCALENDAR\r\n'));
 assert.ok(!value.includes('DTSTART:'));
 assert.match(contractReminderCalendar('2027-01-01',30,uid,now),/TRIGGER:-P30D/);
 assert.match(contractReminderCalendar('2027-01-01',7,uid,now),/TRIGGER:-P7D/);
});
test('invalid, past, impossible and injection dates fail closed',()=>{
 for(const value of ['2026-02-30','2026-11-25','2026-12-01','2027-1-1','9999-12-31','2027-01-01\r\nSUMMARY:injected','']) assert.throws(()=>contractReminderCalendar(value,14,uid,now),undefined,value);
 assert.throws(()=>contractReminderCalendar('2027-01-01',1,uid,now));
 assert.throws(()=>contractReminderCalendar('2027-01-01',14,'injected\r\n',now));
});
test('leap and month boundaries are calendar-day accurate',()=>{
 assert.match(contractReminderCalendar('2028-02-29',7,uid,now),/DTEND;VALUE=DATE:20280301/);
 assert.throws(()=>contractReminderCalendar('2027-02-29',7,uid,now));
});
test('reminder export stays on the owner career surface without backend writes or persistent storage',()=>{
 const journey=readFileSync(new URL('../../../components/PlayerJourney.tsx',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../../../components/ContractReminderExport.tsx',import.meta.url),'utf8');
 assert.ok(journey.includes('isOwnProfile && canManage && !loading && !loadError && <ContractReminderExport key={playerId}'));
 assert.doesNotMatch(panel,/localStorage|sessionStorage|supabase|fetch\(/);
 assert.match(panel,/check that the alert is enabled/);
});
