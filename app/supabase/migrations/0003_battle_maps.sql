-- Battle Map: a Campaign-level, reusable resource (Wayfinder issue #4) —
-- no session_id anywhere; ownership is campaign_id only.
create table public.battle_maps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.battle_maps enable row level security;

create policy "members can read battle maps in their campaigns"
  on public.battle_maps for select
  to authenticated
  using (public.is_campaign_member(campaign_id));

-- DM-only write, same gateway pattern as create_campaign_invitation in 0001.
create function public.create_battle_map(p_campaign_id uuid, p_name text)
returns public.battle_maps
language plpgsql
security definer set search_path = public
as $$
declare
  is_dm boolean;
  new_map public.battle_maps;
begin
  select exists (
    select 1 from public.campaigns
    where id = p_campaign_id and dm_user_id = auth.uid()
  ) into is_dm;

  if not is_dm then
    raise exception 'Only the current DM can create a battle map for this campaign';
  end if;

  insert into public.battle_maps (campaign_id, name, created_by)
  values (p_campaign_id, p_name, auth.uid())
  returning * into new_map;

  return new_map;
end;
$$;

grant select on public.battle_maps to authenticated;
grant execute on function public.create_battle_map(uuid, text) to authenticated;
