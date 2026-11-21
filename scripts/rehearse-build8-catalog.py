# Produce LOCAL rehearsal DDL from a protected, metadata-only catalog export.
# Usage: python3 scripts/rehearse-build8-catalog.py snapshot.json extras.json restore.sql
# Never run the output against a hosted database. It recreates roles and app tables.
# This is an application-schema rehearsal, not a Supabase platform backup/restore tool.
# No user records, passwords, private keys or production connection strings are read.
import json
import argparse
import os
parser=argparse.ArgumentParser(description='Generate disposable local PostgreSQL 17 rehearsal DDL from protected catalog metadata.')
parser.add_argument('snapshot')
parser.add_argument('extras')
parser.add_argument('output')
args=parser.parse_args()
s=json.load(open(args.snapshot))
extras=json.load(open(args.extras))
if not s['version'].startswith('17.'):
 raise SystemExit('This rehearsal targets PostgreSQL 17; review other versions first.')
q=lambda v:'"'+v.replace('"','""')+'"'
lit=lambda v:"'"+v.replace("'","''")+"'"
out=['\\set ON_ERROR_STOP on','SET check_function_bodies=off;']
for r in s['roles']:
 out.append('DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='+lit(r['name'])+') THEN CREATE ROLE '+q(r['name'])+' NOLOGIN; END IF; END $$;')
 out.append('ALTER ROLE '+q(r['name'])+(' BYPASSRLS' if r['bypass'] else ' NOBYPASSRLS')+(' INHERIT;' if r['inherit'] else ' NOINHERIT;'))
schemas={'private','auth','storage','realtime','extensions','hoopcheck_security'}
schemas.update(a['schema'] for a in extras['defaults'] if a['schema'])
for ns in sorted(schemas):out.append('CREATE SCHEMA IF NOT EXISTS '+q(ns)+';')
for ext in ['pgcrypto','uuid-ossp','pg_trgm']:out.append('CREATE EXTENSION IF NOT EXISTS '+q(ext)+' WITH SCHEMA extensions;')
out.append('SET search_path=public,extensions;')
for e in s['enums']:out.append('CREATE TYPE '+q(e['schema'])+'.'+q(e['name'])+' AS ENUM ('+','.join(map(lit,e['labels']))+');')
out.extend(f+';' for f in extras['storage_helpers'])
for t in s['tables']:
 name=q(t['schema'])+'.'+q(t['name'])
 out.append('CREATE TABLE '+name+' ('+','.join(q(c['name'])+' '+c['type']+(' GENERATED ALWAYS AS ('+c['default']+') STORED' if c['generated'] else '')+(' NOT NULL' if c['notnull'] else '') for c in t['columns'])+');')
for f in s['functions']:out.append(f['def']+';')
for t in s['tables']:
 name=q(t['schema'])+'.'+q(t['name'])
 for c in t['columns']:
  # Generated columns were restored with their catalog expressions above.
  if c['default'] and not c['generated']:out.append('ALTER TABLE '+name+' ALTER COLUMN '+q(c['name'])+' SET DEFAULT '+c['default']+';')
for typ in ['p','u','c','f']:
 for t in s['tables']:
  for c in t['constraints'] or []:
   if c['type']==typ:out.append('ALTER TABLE '+q(t['schema'])+'.'+q(t['name'])+' ADD CONSTRAINT '+q(c['name'])+' '+c['def']+';')
for t in s['tables']:
 name=q(t['schema'])+'.'+q(t['name'])
 out.append('REVOKE ALL ON '+name+' FROM PUBLIC;')
 for a in t['acl'] or []:out.append('GRANT '+a['privilege']+' ON '+name+' TO '+('PUBLIC' if a['grantee']=='PUBLIC' else q(a['grantee']))+(' WITH GRANT OPTION' if a['grantable'] else '')+';')
 for a in t['column_acl'] or []:out.append('GRANT '+a['privilege']+' ('+q(a['column'])+') ON '+name+' TO '+('PUBLIC' if a['grantee']=='PUBLIC' else q(a['grantee']))+';')
 if t['rls']:out.append('ALTER TABLE '+name+' ENABLE ROW LEVEL SECURITY;')
 if t['force']:out.append('ALTER TABLE '+name+' FORCE ROW LEVEL SECURITY;')
 for p in t['policies'] or []:
  statement='CREATE POLICY '+q(p['name'])+' ON '+name+(' AS PERMISSIVE' if p['permissive'] else ' AS RESTRICTIVE')+' FOR '+{'r':'SELECT','a':'INSERT','w':'UPDATE','d':'DELETE','*':'ALL'}[p['cmd']]+' TO '+','.join('PUBLIC' if r=='PUBLIC' else q(r) for r in p['roles'])
  if p['using']:statement+=' USING ('+p['using']+')'
  if p['check']:statement+=' WITH CHECK ('+p['check']+')'
  out.append(statement+';')
 for tr in t['triggers'] or []:out.append(tr+';')
for f in s['functions']:
 out.append('ALTER FUNCTION '+f['identity']+' OWNER TO '+q(f['owner'])+';')
 out.append('REVOKE ALL ON FUNCTION '+f['identity']+' FROM PUBLIC;')
 for a in f['acl'] or []:out.append('GRANT EXECUTE ON FUNCTION '+f['identity']+' TO '+('PUBLIC' if a['grantee']=='PUBLIC' else q(a['grantee']))+';')
for schema in ['public','private','auth','storage','realtime','hoopcheck_security']:
 out.append('REVOKE ALL ON SCHEMA '+q(schema)+' FROM PUBLIC;')
for a in extras['schema_acl']:
 out.append('GRANT '+a['privilege']+' ON SCHEMA '+q(a['schema'])+' TO '+('PUBLIC' if a['grantee']=='PUBLIC' else q(a['grantee']))+';')
for m in extras['memberships']:
 out.append('GRANT '+q(m['role'])+' TO '+q(m['member'])+' WITH INHERIT '+str(m['inherit']).upper()+', SET '+str(m['set']).upper()+';')
for a in extras['defaults']:
 prefix='ALTER DEFAULT PRIVILEGES FOR ROLE '+q(a['owner'])+(' IN SCHEMA '+q(a['schema']) if a['schema'] else '')
 out.append(prefix+' GRANT '+a['privilege']+' ON '+{'r':'TABLES','f':'FUNCTIONS','S':'SEQUENCES','T':'TYPES','n':'SCHEMAS'}[a['type']]+' TO '+('PUBLIC' if a['grantee']=='PUBLIC' else q(a['grantee']))+(' WITH GRANT OPTION' if a['grantable'] else '')+';')
with open(args.output,'w') as output:
 os.chmod(args.output,0o600)
 output.write('\n'.join(out)+'\n')
print('Generated schema-only restore:',len(out),'statements')
