-- Dice rolls: an append-only, campaign-scoped record of dice rolled during
-- play. The result is computed server-side (random() in this RPC), so a
-- client can never dictate the outcome. Any campaign member may roll (this is
-- member-gated, not DM-only). No update/delete — a roll stands as history.
create table public.dice_rolls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  roller_id uuid not null references public.profiles (id),
  notation text not null,
  results int[] not null,
  modifier int not null default 0,
  total int not null,
  created_at timestamptz not null default now()
);

alter table public.dice_rolls enable row level security;

create policy "members can read dice rolls in their campaigns"
  on public.dice_rolls for select
  to authenticated
  using (public.is_campaign_member(campaign_id));

-- Server-authoritative roll. Validates the die shape (matching the client's
-- allowed notation), rolls p_count dice of p_sides server-side, sums with the
-- modifier, and records the roll under the calling member's id.
create function public.roll_dice(
  p_campaign_id uuid,
  p_count int,
  p_sides int,
  p_modifier int
)
returns public.dice_rolls
language plpgsql
security definer set search_path = public
as $$
declare
  rolled int[];
  roll_total int;
  new_roll public.dice_rolls;
  notation_text text;
begin
  if not public.is_campaign_member(p_campaign_id) then
    raise exception 'Only a member of this campaign can roll dice here';
  end if;

  if p_count < 1 or p_count > 100 then
    raise exception 'Dice count must be between 1 and 100';
  end if;
  if p_sides not in (2, 3, 4, 6, 8, 10, 12, 20, 100) then
    raise exception 'Unsupported die size';
  end if;
  if abs(p_modifier) > 1000 then
    raise exception 'Modifier out of range';
  end if;

  -- Roll each die server-side: floor(random()*sides)+1, in [1, sides].
  select array_agg(floor(random() * p_sides)::int + 1)
    into rolled
    from generate_series(1, p_count);

  select coalesce(sum(value), 0)::int + p_modifier into roll_total from unnest(rolled) as value;

  notation_text := p_count || 'd' || p_sides ||
    case when p_modifier > 0 then '+' || p_modifier
         when p_modifier < 0 then p_modifier::text
         else '' end;

  insert into public.dice_rolls (campaign_id, roller_id, notation, results, modifier, total)
  values (p_campaign_id, auth.uid(), notation_text, rolled, p_modifier, roll_total)
  returning * into new_roll;

  return new_roll;
end;
$$;

grant select on public.dice_rolls to authenticated;
grant execute on function public.roll_dice(uuid, int, int, int) to authenticated;
