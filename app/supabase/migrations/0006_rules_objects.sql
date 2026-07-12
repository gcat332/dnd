-- Rules Objects: campaign-scoped rules-bearing content (Wayfinder issue #4).
-- This slice authors the `ability` type; the `type` column enum covers the
-- full editable set so later plans add types without a schema change.
-- `damage_type`/`condition` are intentionally excluded (developer-fixed
-- system taxonomy, ticket #7).
create table public.rules_objects (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  type text not null check (type in ('ability','spell','monster','item','encounter','trait','resource')),
  source text not null default 'homebrew' check (source in ('starter','homebrew','ai-generated')),
  name text not null,
  description text not null default '',
  mechanics jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.rules_objects enable row level security;

create policy "members can read rules objects in their campaigns"
  on public.rules_objects for select
  to authenticated
  using (public.is_campaign_member(campaign_id));

-- Shared DM-ownership guard for a rules object's campaign.
create function public.is_rules_object_dm(p_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.rules_objects r
    join public.campaigns c on c.id = r.campaign_id
    where r.id = p_id and c.dm_user_id = auth.uid()
  );
$$;

create function public.create_rules_object(
  p_campaign_id uuid,
  p_type text,
  p_name text,
  p_description text,
  p_mechanics jsonb
)
returns public.rules_objects
language plpgsql
security definer set search_path = public
as $$
declare
  new_object public.rules_objects;
begin
  if not exists (
    select 1 from public.campaigns where id = p_campaign_id and dm_user_id = auth.uid()
  ) then
    raise exception 'Only the current DM can create content for this campaign';
  end if;

  insert into public.rules_objects (campaign_id, type, source, name, description, mechanics, created_by)
  values (p_campaign_id, p_type, 'homebrew', p_name, p_description, p_mechanics, auth.uid())
  returning * into new_object;

  return new_object;
end;
$$;

create function public.update_rules_object(
  p_id uuid,
  p_name text,
  p_description text,
  p_mechanics jsonb
)
returns public.rules_objects
language plpgsql
security definer set search_path = public
as $$
declare
  updated_object public.rules_objects;
begin
  if not public.is_rules_object_dm(p_id) then
    raise exception 'Only the current DM can edit this content';
  end if;

  update public.rules_objects
  set name = p_name, description = p_description, mechanics = p_mechanics
  where id = p_id
  returning * into updated_object;

  return updated_object;
end;
$$;

create function public.delete_rules_object(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_rules_object_dm(p_id) then
    -- Not the DM, or the object doesn't exist. If it's simply already gone,
    -- treat as success (idempotent); otherwise reject.
    if exists (select 1 from public.rules_objects where id = p_id) then
      raise exception 'Only the current DM can delete this content';
    end if;
    return;
  end if;

  delete from public.rules_objects where id = p_id;
end;
$$;

grant select on public.rules_objects to authenticated;
grant execute on function public.create_rules_object(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.update_rules_object(uuid, text, text, jsonb) to authenticated;
grant execute on function public.delete_rules_object(uuid) to authenticated;
