import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const s=readFileSync(new URL("../supabase/candidates/hoopchat_contact_request_status_only_20261122.sql",import.meta.url),"utf8");
assert.match(s,/REVOKE UPDATE ON TABLE public\.player_contact_requests FROM authenticated;/);
assert.match(s,/GRANT UPDATE\(status,responded_at\) ON TABLE public\.player_contact_requests TO authenticated;/);
assert.match(s,/HoopChat contact privilege baseline drift/);
assert.match(s,/HoopChat least-privilege postcheck failed/);
for(const col of ["requester_id","player_id","message","id","created_at"])
 assert.match(s,new RegExp("has_column_privilege\\('authenticated',t,'"+col+"','UPDATE'\\)"));
assert.match(s,/NOT has_table_privilege\('service_role',t,'UPDATE'\)/);
assert.match(s,/NOT \(SELECT relrowsecurity FROM pg_class WHERE oid=t\)/);
assert.doesNotMatch(s,/\bGRANT\s+(?:SELECT|ALL)\b/i);
assert.doesNotMatch(s,/\bALTER\s+POLICY\b|\bDROP\s+POLICY\b/i);
assert.doesNotMatch(s,/\bDELETE\s+FROM\b|\bUPDATE\s+public\.profiles\b/i);
console.log("PASS: HoopChat contact-request status-only UPDATE contract; roles and RLS preserved");
