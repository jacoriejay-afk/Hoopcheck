-- Server-side lock for player identity fields and richer signup profile initialization.
create or replace function public.lock_player_identity_fields() returns trigger language plpgsql as $$
begin
 if tg_op='UPDATE' then
   if old.username is not null and new.username is distinct from old.username then raise exception 'Username is locked after account creation'; end if;
   if old.account_type='player' and (new.position is distinct from old.position or new.years_pro is distinct from old.years_pro) then raise exception 'Player position and years pro are locked after account creation'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists profiles_lock_player_identity_fields on public.profiles;
create trigger profiles_lock_player_identity_fields before update on public.profiles for each row execute function public.lock_player_identity_fields();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles (id,display_name,username,account_type,position,years_pro,professional_experience,is_adult,agreed_to_terms,terms_accepted_at,terms_version)
 values (new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),lower(nullif(new.raw_user_meta_data->>'username','')),coalesce(new.raw_user_meta_data->>'account_type','player'),case when new.raw_user_meta_data->>'account_type'='player' then new.raw_user_meta_data->>'position' else null end,case when new.raw_user_meta_data->>'account_type'='player' then (new.raw_user_meta_data->>'years_pro')::integer else null end,coalesce((new.raw_user_meta_data->>'professional_experience')::boolean,false),coalesce((new.raw_user_meta_data->>'is_adult')::boolean,false),coalesce((new.raw_user_meta_data->>'agreed_to_terms')::boolean,false),case when new.raw_user_meta_data->>'terms_accepted_at' is not null then (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz else null end,new.raw_user_meta_data->>'terms_version');
 return new;
end; $$;