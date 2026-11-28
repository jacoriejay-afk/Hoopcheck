-- Supplemental synthetic group directory regression.
ALTER TABLE public.profiles ADD COLUMN account_type text NOT NULL DEFAULT 'player';
ALTER TABLE public.hoop_group_spaces ADD COLUMN accent_color text NOT NULL DEFAULT 'orange',ADD COLUMN icon_key text NOT NULL DEFAULT 'basketball';
GRANT SELECT ON public.profiles TO authenticated;
\ir ../candidates/hoopgroups_directory_page_review_only.sql
INSERT INTO public.hoop_group_spaces(id,slug,name,description,category,owner_id)
 SELECT ('60000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'fixture-'||i,CASE WHEN i=61 THEN 'Needle outside first page' ELSE 'Fixture community' END,'','players','10000000-0000-4000-8000-000000000001' FROM generate_series(1,61) i;
SET fixture.active='yes';SET fixture.mfa='yes';SET ROLE authenticated;
SET request.jwt.claim.sub='10000000-0000-4000-8000-000000000003';
DO $f$ DECLARE p jsonb; n int:=0; cursor uuid; pages int:=0; BEGIN
 LOOP
  p:=public.hoop_group_directory_page('','all',cursor);
  n:=n+jsonb_array_length(p->'rows');pages:=pages+1;
  EXIT WHEN NOT (p->>'has_more')::boolean;
  cursor:=(p->'rows'->49->>'id')::uuid;
  IF pages>5 THEN RAISE EXCEPTION 'Directory loop';END IF;
 END LOOP;
 IF n<62 OR pages<2 THEN RAISE EXCEPTION 'Directory truncated';END IF;
 IF jsonb_array_length(public.hoop_group_directory_page('Needle outside first page')->'rows')<>1 THEN RAISE EXCEPTION 'Server search truncated';END IF;
 IF jsonb_array_length(public.hoop_group_directory_page('Private group')->'rows')<>0 THEN RAISE EXCEPTION 'Private group name leaked';END IF;
 IF jsonb_array_length(public.hoop_group_directory_page('Private channel')->'rows')<>0 THEN RAISE EXCEPTION 'Private channel name leaked';END IF;
 IF jsonb_array_length(public.hoop_group_directory_page('','all',NULL,'fixture-61')->'rows')<>1 THEN RAISE EXCEPTION 'Older shared link unresolved';END IF;
 IF jsonb_array_length(public.hoop_group_directory_page('','joined')->'rows')<>0 THEN RAISE EXCEPTION 'Foreign membership exposed';END IF;
 PERFORM set_config('fixture.active','no',false);
 BEGIN PERFORM public.hoop_group_directory_page();RAISE EXCEPTION 'Revoked directory accessible';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $f$;
RESET ROLE;
SELECT 'PASS synthetic caller-scoped group directory, older search and link, private channel metadata protection';
