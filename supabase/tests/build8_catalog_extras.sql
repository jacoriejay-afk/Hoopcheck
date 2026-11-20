-- Read-only metadata; store output privately alongside build8_catalog_snapshot.sql.
SELECT jsonb_build_object(
 'defaults',(SELECT coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'type',d.defaclobjtype,'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee)::text END,'privilege',a.privilege_type,'grantable',a.is_grantable)),'[]'::jsonb) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) a),
 'memberships',(SELECT jsonb_agg(jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'inherit',inherit_option,'set',set_option)) FROM pg_auth_members),
 'schema_acl',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee)::text END,'privilege',a.privilege_type)) FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname IN ('public','private','auth','storage','realtime','hoopcheck_security')),
 'storage_helpers',(SELECT jsonb_agg(pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='storage' AND p.proname IN ('foldername','filename','extension'))
) AS extras;
