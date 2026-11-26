-- REVIEW ONLY: apply in a disposable database after the original StoreKit
-- migration. Do not edit its historical migration file or enable live billing.
-- The live read-only audit found these five Stripe-only authorization paths.
-- Preserve function signatures, security, ownership, ACLs and policy commands.
DO $$
DECLARE f record; target text; rewritten text; matched integer:=0;
BEGIN
  IF to_regclass('public.membership_entitlements') IS NULL OR to_regclass('public.membership_authorizations') IS NULL THEN
    RAISE EXCEPTION 'Membership source migration required first';
  END IF;
  FOR f IN
    SELECT p.oid,pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prokind='f' AND ((n.nspname='private' AND p.proname='can_interact_with_approved_review')
      OR (n.nspname='public' AND p.proname='get_review_like_count'))
      AND p.pronargs=1 AND p.proargtypes[0]='uuid'::regtype
  LOOP
    matched:=matched+1;
    target:=CASE WHEN f.definition ILIKE '%access_status%' THEN 'public.membership_authorizations' ELSE 'public.membership_entitlements' END;
    rewritten:=regexp_replace(f.definition,'\m(public\.)?subscriptions\M',target,'g');
    IF rewritten=f.definition AND position(target in f.definition)=0 THEN
      RAISE EXCEPTION 'Unexpected review authorization definition: %',f.oid::regprocedure;
    END IF;
    IF rewritten<>f.definition THEN EXECUTE rewritten; END IF;
  END LOOP;
  IF matched<>2 THEN RAISE EXCEPTION 'Review authorization inventory changed'; END IF;
END $$;
DO $$
DECLARE p record; statement text; target text; matched integer:=0; old_text text;
BEGIN
  FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename='player_career_stops'
    AND policyname IN ('career stops eligible owner delete','career stops eligible owner insert','career stops eligible owner update')
  LOOP
    matched:=matched+1;
    old_text:=coalesce(p.qual,'')||coalesce(p.with_check,'');
    target:=CASE WHEN old_text ILIKE '%access_status%' THEN 'public.membership_authorizations' ELSE 'public.membership_entitlements' END;
    IF old_text !~ '\msubscriptions\M' AND position(target in old_text)=0 AND position(split_part(target,'.',2) in old_text)=0 THEN
      RAISE EXCEPTION 'Unexpected career authorization definition: %',p.policyname;
    END IF;
    statement:=format('ALTER POLICY %I ON public.%I',p.policyname,p.tablename);
    IF p.qual IS NOT NULL THEN statement:=statement||' USING ('||regexp_replace(p.qual,'\m(public\.)?subscriptions\M',target,'g')||')'; END IF;
    IF p.with_check IS NOT NULL THEN statement:=statement||' WITH CHECK ('||regexp_replace(p.with_check,'\m(public\.)?subscriptions\M',target,'g')||')'; END IF;
    EXECUTE statement;
  END LOOP;
  IF matched<>3 THEN RAISE EXCEPTION 'Career authorization inventory changed'; END IF;
END $$;
-- Re-check these exact functions and policies after migration; any drift
-- must be reviewed. The owner/admin billing and Stripe ledger paths stay intact.
