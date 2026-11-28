#!/usr/bin/env python3
"""Generate an ephemeral extension of the existing reviewed 57-assertion runner.
Never edit the original; do not execute this generator against a hosted DB."""
import argparse, hashlib, pathlib, re, subprocess
p=argparse.ArgumentParser()
p.add_argument("original",type=pathlib.Path)
p.add_argument("candidate_sha")
p.add_argument("output",type=pathlib.Path)
a=p.parse_args()
raw=a.original.read_bytes()
if hashlib.sha256(raw).hexdigest()!="fc218403c02f7573f0287b4bba5252a6200737d82ad058e6b184f2127dcf8d60":
    raise SystemExit("Original runner checksum differs; do not repin an unreviewed runner")
if not re.fullmatch(r"[a-f0-9]{40}",a.candidate_sha):
    raise SystemExit("A frozen, full candidate SHA is required")
s=raw.decode("utf-8")
def once(old,new):
    global s
    if s.count(old)!=1:
        raise SystemExit("Original runner structure changed")
    s=s.replace(old,new,1)
once("expected=f7910eeb505254d027ee414d309eaa1112f195ae","expected="+a.candidate_sha)
once('git -C "$repo" fetch --no-tags origin refs/pull/1198/head\n[[ $(git -C "$repo" rev-parse FETCH_HEAD) == "$expected" ]] || { echo \'PR head changed: obtain a repinned runner\' >&2; exit 1; }',
     'git -C "$repo" cat-file -e "$expected^{commit}" 2>/dev/null || git -C "$repo" fetch --no-tags origin "$expected"\n[[ $(git -C "$repo" rev-parse "$expected^{commit}") == "$expected" ]] || { echo \'Immutable candidate mismatch\' >&2; exit 1; }')
anchor='get supabase/candidates/step2_review_moderation_read_guard_review_only.sql "$work/moderation.sql"'
inputs=[
 ("supabase/candidates/account_export_fulfillment_review_only.sql","export.sql"),
 ("supabase/candidates/account_export_media_review_only.sql","media.sql"),
 ("supabase/candidates/appstore_deletion_review_retention_review_only.sql","retention.sql"),
 ("supabase/candidates/appstore_deletion_auth_session_revocation_review_only.sql","auth-revoke.sql"),
 ("supabase/candidates/appstore_deletion_export_cleanup_review_only.sql","export-cleanup.sql"),
 ("supabase/tests/step12_privacy_extensions_actual_schema.sql","privacy-probes.sql"),
]
once(anchor,anchor+"\n"+"\n".join('get '+path+' "$work/'+name+'"' for path,name in inputs))
marker="SELECT 'PASS: populated actual-schema candidate ACL, paid and own read parity, caller isolation, MFA and session denial; workers disabled';"
old=marker+"\nROLLBACK;\n''')"
new=marker+"""
''')
# Append the additional exact-head candidate SQL without transaction commits.
# Old positive/negative ACL probes and the original 57 baseline assertions
# remain untouched. The original rollback/readback covers all added objects.
for name in ['export.sql','media.sql','retention.sql','auth-revoke.sql','export-cleanup.sql']:
 s=(w/name).read_text()
 assert len(re.findall(r'(?im)^BEGIN;\\s*$',s))==1 and len(re.findall(r'(?im)^COMMIT;\\s*$',s))==1, name
 s=re.sub(r'(?im)^BEGIN;\\s*$','',s,count=1)
 s=re.sub(r'(?im)^COMMIT;\\s*\\Z','',s)
 assert not re.search(r'(?im)^\\s*(BEGIN|COMMIT|ROLLBACK|END TRANSACTION);\\s*$',s), name
 chunks.append(s)
extra=(w/'privacy-probes.sql').read_text()
assert not re.search(r'(?im)^\\s*(BEGIN|COMMIT|ROLLBACK|END TRANSACTION);\\s*$',extra)
chunks.append(extra)
chunks.append('ROLLBACK;')
"""
once(old,new)
check=" grep -Fq '"+marker[len("SELECT '"):-2]+"' \"$work/step12-acceptance.log\" || status=1"
# This uses a distinct required marker so prior baseline success cannot
# silently mask a skipped supplemental privacy phase.
once(check,check+"\n grep -Fq 'PASS: actual-schema privacy extensions and fenced effects' \"$work/step12-acceptance.log\" || status=1")
if a.output.resolve()==a.original.resolve():
    raise SystemExit("Refusing to modify original runner")
# Exclusive create: never overwrite a previous runner or evidence.
with a.output.open("x",encoding="utf-8") as f:
    f.write(s)
a.output.chmod(0o700)
subprocess.run(["bash","-n",str(a.output)],check=True)
print("Generated extended runner. Original baseline, immutable commit, image, catalog, ledger and rollback checks preserved.")
