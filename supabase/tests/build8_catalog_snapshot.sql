WITH rel AS (
 select c.*,n.nspname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where (n.nspname in ('public','private') and c.relkind in ('r','p','v','m'))
 or (n.nspname='auth' and c.relname in ('users','mfa_factors') and c.relkind='r')
 or (n.nspname='storage' and c.relname='objects' and c.relkind='r')
 or (n.nspname='realtime' and c.relname='messages' and c.relkind in ('r','p'))
)
select jsonb_build_object(
'version',current_setting('server_version'),
'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'inherit',rolinherit,'bypass',rolbypassrls)) from pg_roles where rolname !~ '^pg_' and rolname<>'postgres'),
'enums',(select jsonb_agg(x) from (select n.nspname as schema,t.typname as name,array_agg(e.enumlabel order by e.enumsortorder) as labels from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname in ('public','private','auth','storage','realtime') group by n.nspname,t.typname) x),
'tables',(select jsonb_agg(jsonb_build_object('schema',r.nspname,'name',r.relname,'rls',r.relrowsecurity,'force',r.relforcerowsecurity,
'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped),
'constraints',(select jsonb_agg(jsonb_build_object('name',c.conname,'type',c.contype,'def',pg_get_constraintdef(c.oid))) from pg_constraint c where c.conrelid=r.oid and (c.contype<>'f' or c.confrelid in (select oid from rel))),
'policies',(select jsonb_agg(jsonb_build_object('name',p.polname,'permissive',p.polpermissive,'cmd',p.polcmd,'roles',(select jsonb_agg(case when v=0 then 'PUBLIC' else pg_get_userbyid(v)::text end) from unnest(p.polroles) v),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))) from pg_policy p where p.polrelid=r.oid),
'acl',(select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee)::text end,'privilege',a.privilege_type,'grantable',a.is_grantable)) from aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) a),
'column_acl',(select jsonb_agg(jsonb_build_object('column',at.attname,'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee)::text end,'privilege',a.privilege_type)) from pg_attribute at cross join lateral aclexplode(at.attacl) a where at.attrelid=r.oid and at.attnum>0),
'triggers',(select jsonb_agg(pg_get_triggerdef(t.oid)) from pg_trigger t where t.tgrelid=r.oid and not t.tgisinternal and r.nspname in ('public','private'))
)) from rel r where r.relkind in ('r','p')),
'functions',(select jsonb_agg(jsonb_build_object('def',pg_get_functiondef(p.oid),'identity',format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'owner',pg_get_userbyid(p.proowner),'acl',(select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee)::text end,'privilege',a.privilege_type)) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and (n.nspname in ('public','private','hoopcheck_security') or (n.nspname='auth' and p.proname in ('uid','jwt','role')))),
'views',(select jsonb_agg(jsonb_build_object('name',format('%I.%I',r.nspname,r.relname),'def',pg_get_viewdef(r.oid,true),'options',r.reloptions)) from rel r where r.relkind='v'),
'role_settings',(select jsonb_agg(jsonb_build_object('role',coalesce(pg_get_userbyid(s.setrole)::text,'all'),'settings',s.setconfig)) from pg_db_role_setting s where s.setrole in (0,(select oid from pg_roles where rolname='authenticator'))),
'history',(select jsonb_agg(jsonb_build_object('version',version,'name',name)) from supabase_migrations.schema_migrations)
) as snapshot;
