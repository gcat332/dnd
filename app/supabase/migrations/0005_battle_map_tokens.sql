-- Tokens: movable markers belonging to a Battle Map (Wayfinder issue #4).
-- battle_map_id is the only ownership axis; no session_id, no character link
-- yet (per-player ownership is a later subsystem needing Characters).
-- "column"/"row" are quoted because `column` is a reserved word in SQL.
create table public.tokens (
  id uuid primary key default gen_random_uuid(),
  battle_map_id uuid not null references public.battle_maps (id) on delete cascade,
  label text not null,
  color text not null,
  "column" int not null,
  "row" int not null,
  elevation real not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.tokens enable row level security;

create policy "members can read tokens on maps in their campaigns"
  on public.tokens for select
  to authenticated
  using (
    exists (
      select 1 from public.battle_maps m
      where m.id = tokens.battle_map_id and public.is_campaign_member(m.campaign_id)
    )
  );

-- Shared DM-ownership guard: is auth.uid() the DM of the campaign that owns
-- this battle map? Used by all three write RPCs below.
create function public.is_battle_map_dm(p_map_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.battle_maps m
    join public.campaigns c on c.id = m.campaign_id
    where m.id = p_map_id and c.dm_user_id = auth.uid()
  );
$$;

create function public.create_token(
  p_map_id uuid,
  p_label text,
  p_color text,
  p_column int,
  p_row int
)
returns public.tokens
language plpgsql
security definer set search_path = public
as $$
declare
  new_token public.tokens;
begin
  if not public.is_battle_map_dm(p_map_id) then
    raise exception 'Only the current DM can add tokens to this battle map';
  end if;

  insert into public.tokens (battle_map_id, label, color, "column", "row", created_by)
  values (p_map_id, p_label, p_color, p_column, p_row, auth.uid())
  returning * into new_token;

  return new_token;
end;
$$;

create function public.move_token(p_token_id uuid, p_column int, p_row int)
returns public.tokens
language plpgsql
security definer set search_path = public
as $$
declare
  target_map uuid;
  moved_token public.tokens;
begin
  select battle_map_id into target_map from public.tokens where id = p_token_id;
  if target_map is null then
    raise exception 'Token not found';
  end if;
  if not public.is_battle_map_dm(target_map) then
    raise exception 'Only the current DM can move tokens on this battle map';
  end if;

  update public.tokens
  set "column" = p_column, "row" = p_row
  where id = p_token_id
  returning * into moved_token;

  return moved_token;
end;
$$;

create function public.delete_token(p_token_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  target_map uuid;
begin
  select battle_map_id into target_map from public.tokens where id = p_token_id;
  if target_map is null then
    return; -- already gone; treat as success (idempotent)
  end if;
  if not public.is_battle_map_dm(target_map) then
    raise exception 'Only the current DM can delete tokens on this battle map';
  end if;

  delete from public.tokens where id = p_token_id;
end;
$$;

grant select on public.tokens to authenticated;
grant execute on function public.create_token(uuid, text, text, int, int) to authenticated;
grant execute on function public.move_token(uuid, int, int) to authenticated;
grant execute on function public.delete_token(uuid) to authenticated;
