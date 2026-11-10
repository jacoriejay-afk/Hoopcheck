-- UX-2B: one self-service player profile completion contract.
alter table public.profiles add column if not exists height text;

-- Position and current country are ordinary player profile details and must be
-- editable from the guided checklist. Verified team-link IDs and legal identity
-- fields remain protected; current_team is the player's editable display value.
create or replace function public.enforce_player_profile_locks()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null or public.is_current_user_admin_or_moderator() then
    return new;
  end if;

  if old.account_type = 'player' then
    if new.years_pro is distinct from old.years_pro then
      raise exception 'Professional years can only be changed through an authorized workflow.';
    end if;
    if new.country is distinct from old.country then
      raise exception 'Country of origin cannot be changed after selection.';
    end if;
    if new.selected_team_id is distinct from old.selected_team_id
       or new.selected_womens_team_id is distinct from old.selected_womens_team_id then
      raise exception 'Verified team affiliations can only be changed through an authorized workflow.';
    end if;
    if new.display_name is distinct from old.display_name and old.display_name is not null then
      if (select count(*) from public.display_name_changes where user_id = old.id and changed_at >= date_trunc('month', now())) >= 2 then
        raise exception 'Display name can only be changed twice per month.';
      end if;
      insert into public.display_name_changes(user_id) values(old.id);
      new.display_name_changed_at := now();
    end if;
  end if;
  return new;
end;
$$;
