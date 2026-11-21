import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
if (!['127.0.0.1','localhost'].includes(process.env.PGHOST)) throw new Error('Negative SQL fixtures require an isolated localhost database');
const fixture=readFileSync(new URL('../supabase/tests/opted_in_mfa.sql',import.meta.url),'utf8').replace(/^\\set .*$/mg,'');
const migration=readFileSync(new URL('../supabase/migrations/20261118162456_opted_in_mfa_enforcement.sql',import.meta.url),'utf8');
for (const [label, sql, expected] of [
 ['baseline', fixture.replace(/^\\ir .*$/m,''), /MFA AAL1 read bypass/],
 ['hook_conflict', fixture.replace(/^\\ir .*$/m,()=>"ALTER ROLE authenticator SET pgrst.db_pre_request='existing.guard';\n"+migration), /Existing PostgREST pre-request hook must be reconciled/],
]) {
 const database=`hoopcheck_mfa_${label}_${process.pid}`;
 const create=spawnSync('createdb',[database],{encoding:'utf8'});assert.equal(create.status,0,create.stderr);
 try { const result=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-d',database],{input:sql,encoding:'utf8'});assert.notEqual(result.status,0,`${label} unexpectedly passed`);assert.match(result.stderr,expected);console.log(`PASS negative MFA SQL: ${label}`); }
 finally {const drop=spawnSync('dropdb',[database],{encoding:'utf8'});assert.equal(drop.status,0,drop.stderr);}
}
