-- Profiles mirror auth.users so app code never queries the auth schema directly.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_username text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by any authenticated user"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Populate a profile row whenever a new auth user signs up via Discord.
-- jsonb `->`/`->>` return null for a missing key rather than erroring, so
-- this is safe to run even if a guessed key name turns out wrong — but the
-- exact keys Supabase's Discord provider sets in raw_user_meta_data must
-- still be confirmed against a real sign-in (Task 8 Step 12 does this) and
-- this function corrected via a follow-up migration if discord_username
-- comes back null in practice.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, discord_username, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data -> 'custom_claims' ->> 'global_name',
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Campaigns: the aggregate root (Wayfinder issue #4).
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dm_user_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create table public.campaign_memberships (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('dm', 'player')),
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

alter table public.campaign_memberships enable row level security;

create table public.campaign_invitations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles (id),
  max_uses int,
  use_count int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.campaign_invitations enable row level security;

-- Select policies: members can see their own campaigns and fellow members.
-- No insert/update/delete policies are defined on these three tables for the
-- `authenticated` role — all writes happen through the SECURITY DEFINER RPCs
-- below, which run with elevated privilege and bypass RLS by design. This is
-- the deliberate "gateway" pattern for campaign CRUD (issue #3's Edge
-- Function gateway is a separate mechanism, reserved for rules-affecting
-- gameplay actions, not used here).

-- Helper used by the two policies below. A plain in-policy subquery on
-- campaign_memberships that itself filters campaign_memberships triggers
-- Postgres's "infinite recursion detected in policy for relation
-- campaign_memberships" (42P17): evaluating the policy's own USING clause
-- requires re-evaluating that same policy for the subquery. Wrapping the
-- membership check in a SECURITY DEFINER function breaks the cycle — the
-- function runs as its owner (the migration role, which owns the table and
-- so bypasses RLS on it by default) instead of re-entering the calling
-- session's RLS policy. This is the standard fix Supabase's own RLS docs
-- recommend for self-referential membership policies; it changes only the
-- implementation, not the access semantics described in the comment above.
create function public.is_campaign_member(p_campaign_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.campaign_memberships
    where campaign_id = p_campaign_id and user_id = auth.uid()
  );
$$;

create policy "members can read their campaigns"
  on public.campaigns for select
  to authenticated
  using (public.is_campaign_member(id));

create policy "members can read memberships of their campaigns"
  on public.campaign_memberships for select
  to authenticated
  using (public.is_campaign_member(campaign_id));

create policy "dm can read invitations they created"
  on public.campaign_invitations for select
  to authenticated
  using (created_by = auth.uid());

-- Atomically create a campaign and its DM membership row.
create function public.create_campaign(p_name text)
returns public.campaigns
language plpgsql
security definer set search_path = public
as $$
declare
  new_campaign public.campaigns;
begin
  insert into public.campaigns (name, dm_user_id)
  values (p_name, auth.uid())
  returning * into new_campaign;

  insert into public.campaign_memberships (campaign_id, user_id, role)
  values (new_campaign.id, auth.uid(), 'dm');

  return new_campaign;
end;
$$;

-- Only the current DM of a campaign may mint an invitation code for it.
create function public.create_campaign_invitation(p_campaign_id uuid)
returns public.campaign_invitations
language plpgsql
security definer set search_path = public
as $$
declare
  is_dm boolean;
  new_invitation public.campaign_invitations;
  generated_code text;
begin
  select exists (
    select 1 from public.campaigns
    where id = p_campaign_id and dm_user_id = auth.uid()
  ) into is_dm;

  if not is_dm then
    raise exception 'Only the current DM can create an invitation for this campaign';
  end if;

  generated_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  insert into public.campaign_invitations (campaign_id, code, created_by)
  values (p_campaign_id, generated_code, auth.uid())
  returning * into new_invitation;

  return new_invitation;
end;
$$;

-- Redeem an invitation code: adds the caller as a player, enforces expiry/use limits.
create function public.redeem_campaign_invitation(p_code text)
returns public.campaign_memberships
language plpgsql
security definer set search_path = public
as $$
declare
  invitation public.campaign_invitations;
  new_membership public.campaign_memberships;
begin
  select * into invitation
  from public.campaign_invitations
  where code = p_code
  for update;

  if invitation.id is null then
    raise exception 'Invitation code not found';
  end if;

  if invitation.expires_at is not null and invitation.expires_at < now() then
    raise exception 'Invitation has expired';
  end if;

  if invitation.max_uses is not null and invitation.use_count >= invitation.max_uses then
    raise exception 'Invitation has reached its maximum number of uses';
  end if;

  if exists (
    select 1 from public.campaign_memberships
    where campaign_id = invitation.campaign_id and user_id = auth.uid()
  ) then
    raise exception 'You are already a member of this campaign';
  end if;

  insert into public.campaign_memberships (campaign_id, user_id, role)
  values (invitation.campaign_id, auth.uid(), 'player')
  returning * into new_membership;

  update public.campaign_invitations
  set use_count = use_count + 1
  where id = invitation.id;

  return new_membership;
end;
$$;
