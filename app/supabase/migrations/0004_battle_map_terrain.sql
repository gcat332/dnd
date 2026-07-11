-- Terrain: a per-Battle-Map list of rectangular blocks, stored as one JSONB
-- blob (edited and loaded together with the map, never queried across maps).
alter table public.battle_maps
  add column terrain jsonb not null default '[]'::jsonb;

-- DM-only terrain write, same gateway pattern as create_battle_map in 0003.
-- Deep per-feature validation lives in the TypeScript terrain module (shared
-- by the editor and the read path); this RPC enforces DM ownership and that
-- the payload is a JSON array, which is the security-relevant part.
create function public.set_battle_map_terrain(p_map_id uuid, p_terrain jsonb)
returns public.battle_maps
language plpgsql
security definer set search_path = public
as $$
declare
  is_dm boolean;
  updated_map public.battle_maps;
begin
  select exists (
    select 1
    from public.battle_maps m
    join public.campaigns c on c.id = m.campaign_id
    where m.id = p_map_id and c.dm_user_id = auth.uid()
  ) into is_dm;

  if not is_dm then
    raise exception 'Only the current DM can edit this battle map''s terrain';
  end if;

  if jsonb_typeof(p_terrain) <> 'array' then
    raise exception 'Terrain must be a JSON array';
  end if;

  update public.battle_maps
  set terrain = p_terrain
  where id = p_map_id
  returning * into updated_map;

  return updated_map;
end;
$$;

grant execute on function public.set_battle_map_terrain(uuid, jsonb) to authenticated;
