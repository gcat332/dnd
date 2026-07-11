# Taleforge Battle Map Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Campaign a list of named Battle Maps a DM can create, and let any campaign member open one to see it actually rendered by the validated Three.js/React-Three-Fiber scene — proving the real data-to-3D-scene wiring end to end, without yet building terrain editing, token placement, or live session sync (each is its own future plan).

**Architecture:** A new `battle_maps` Postgres table (Campaign-scoped, per Wayfinder issue #4), gated the same way `campaigns`/`campaign_invitations` are — RLS for reads, a `SECURITY DEFINER` RPC for the one DM-only write. A new production-facing `BattleMapView` component in the existing `app/src/battle-map/` folder mounts the already-validated `BattleMapScene` (from the `battle-map-renderer` prototype, promoted to `app/` in the Foundation plan) with its own built-in empty defaults — no terrain, no tokens, no custom lights — which is enough to prove a real map row can be fetched and rendered as a real 3D scene.

**Tech Stack:** Same as Foundation (Vite, React 19, TypeScript, Vitest, `@supabase/supabase-js`, `react-router`, Three.js/`@react-three/fiber` via the existing `app/src/battle-map/` code). No new dependencies.

## Global Constraints

- This plan implements Wayfinder decision from `gcat332/dnd` issue #4: Battle Map is a Campaign-level, reusable resource (not per-Session) — `battle_maps.campaign_id` is the only ownership axis; there is no `session_id` column anywhere in this plan.
- Battle Map creation is a DM-only action (matches the "DM Prep" decision from issue #2 — battle maps are DM-authored content). Reads are open to any campaign member, same shape as `campaigns`/`campaign_memberships` in `0001_campaign_foundation.sql`.
- Writes go through a `SECURITY DEFINER` RPC (`create_battle_map`), never a direct client insert — same gateway pattern as `create_campaign`/`create_campaign_invitation`. This is unrelated to the future Edge-Function gameplay gateway (issue #3/#6); that's for rules-affecting live-play actions, not for creating a map record.
- The 3D coordinate space is fixed at `MAP_SIZE_CELLS = 200` (`app/src/battle-map/domain/grid.ts:1`) for every Battle Map — this is a maximum bound on the logical map, not a per-map configurable width/height, so `battle_maps` has no dimension columns. Do not add any.
- `BattleMapScene` (`app/src/battle-map/scene/BattleMapScene.tsx`) already defaults every prop (`tokens = NO_TOKENS`, `visibility = ALL_VISIBLE`, `lights = NO_LIGHTS`, etc. — see lines 118-131) — this plan renders it with **zero** props, deliberately. Terrain (`DimensionalTerrain`) is currently hardcoded fixture geometry, not data-driven; making it data-driven is explicitly OUT of scope here and left to a future "Battle Map terrain editor" plan. Do not attempt to wire terrain in this plan.
- `BattleMapCanvas` (`app/src/battle-map/BattleMapCanvas.tsx`) is a dev/e2e-test harness (URL-param viewer switching, stress-mode fixtures, hidden diagnostic `<output>` elements for Playwright) — it is NOT the production entry point and this plan does not modify it. This plan adds a separate, new `BattleMapView` component for real app use.
- Every migration file is new (append-only) — this plan adds `0003_battle_maps.sql`; it must never edit `0001_campaign_foundation.sql` or `0002_grants.sql`.
- No placeholder/mock **data** ships — every UI reads/writes the real Supabase project; mocking `../lib/supabaseClient` inside a unit test is expected TDD isolation, not a violation.

---

## File Structure

```
app/
  supabase/migrations/
    0003_battle_maps.sql          # battle_maps table, RLS, create_battle_map RPC, grants (Task 1)
  tests/integration/
    battle-maps.rpc.test.ts        # real Postgres integration test (Task 1)
  src/
    battle-maps/                   # new top-level domain folder, sibling to campaigns/
      api.ts                       # createBattleMap, listCampaignBattleMaps, getBattleMap (Task 2)
      api.test.ts
      BattleMapListPanel.tsx        # list + "New Battle Map" form, rendered from the dashboard (Task 3)
      BattleMapListPanel.test.tsx
      BattleMapPage.tsx             # route-level: fetches one map by id, loading/error/not-found (Task 4)
      BattleMapPage.test.tsx
    battle-map/
      BattleMapView.tsx             # NEW production 3D viewer: Canvas + camera + <BattleMapScene /> (Task 5)
      BattleMapView.test.tsx
    campaigns/
      CampaignDashboardPage.tsx     # modified: renders <BattleMapListPanel /> (Task 3)
    router.tsx                      # modified: adds /campaigns/:campaignId/maps/:mapId (Task 4)
```

---

### Task 1: `battle_maps` schema, RLS, and RPC

**Files:**
- Create: `app/supabase/migrations/0003_battle_maps.sql`
- Create: `app/tests/integration/battle-maps.rpc.test.ts`

**Interfaces:**
- Consumes: `public.is_campaign_member(p_campaign_id uuid)` and `public.campaigns` (both from `0001_campaign_foundation.sql`)
- Produces: table `public.battle_maps` (`id uuid`, `campaign_id uuid`, `name text`, `created_by uuid`, `created_at timestamptz`) and RPC `create_battle_map(p_campaign_id uuid, p_name text) returns public.battle_maps` — Task 2's `api.ts` calls this by exact name/params.

- [ ] **Step 1: Write the migration**

Create `app/supabase/migrations/0003_battle_maps.sql`:

```sql
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
```

- [ ] **Step 2: Apply the migration locally**

```bash
cd app
npx supabase status   # confirm the local stack from the Foundation plan is still up; `npx supabase start` if not
npx supabase db reset
```

Expected: "Finished supabase db reset" with no SQL errors — this re-applies `0001`, `0002`, and the new `0003` from scratch.

- [ ] **Step 3: Write the integration test**

Create `app/tests/integration/battle-maps.rpc.test.ts` — follow the exact same two-user (`dm`/`player`) real-Postgres pattern as `app/tests/integration/campaigns.rpc.test.ts` (same `createTestUserClient` helper, same env var contract, same `afterAll` cleanup-order fix already established there — delete a user's `campaigns` rows before deleting the user, since `battle_maps` cascades from `campaigns.id`):

```typescript
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.SUPABASE_ANON_KEY

if (!SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error(
    'Set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY (from `supabase status`) before running npm run test:db',
  )
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

type Campaign = { id: string; name: string; dm_user_id: string }
type BattleMap = { id: string; campaign_id: string; name: string; created_by: string }
type RpcSingleResult<T> = { data: T | null; error: { message: string } | null }

async function createTestUserClient(email: string) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: 'test-password-123',
    email_confirm: true,
  })
  if (error) throw error

  const client = createClient(SUPABASE_URL, ANON_KEY!)
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: 'test-password-123',
  })
  if (signInError) throw signInError

  return { client, userId: data.user.id }
}

describe('battle map RPCs', () => {
  let dm: Awaited<ReturnType<typeof createTestUserClient>>
  let player: Awaited<ReturnType<typeof createTestUserClient>>

  beforeAll(async () => {
    dm = await createTestUserClient(`dm-${Date.now()}@example.test`)
    player = await createTestUserClient(`player-${Date.now()}@example.test`)
  })

  afterAll(async () => {
    const { error: dmCampaignsError } = await adminClient
      .from('campaigns')
      .delete()
      .eq('dm_user_id', dm.userId)
    if (dmCampaignsError) throw dmCampaignsError

    const { error: dmDeleteError } = await adminClient.auth.admin.deleteUser(dm.userId)
    if (dmDeleteError) throw dmDeleteError
    const { error: playerDeleteError } = await adminClient.auth.admin.deleteUser(player.userId)
    if (playerDeleteError) throw playerDeleteError
  })

  it('lets the DM create a battle map for their own campaign', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'The Sunken Keep' })
      .single()) as RpcSingleResult<Campaign>

    const { data: map, error } = (await dm.client
      .rpc('create_battle_map', { p_campaign_id: campaign!.id, p_name: 'Keep — Ground Floor' })
      .single()) as RpcSingleResult<BattleMap>

    expect(error).toBeNull()
    expect(map?.name).toBe('Keep — Ground Floor')
    expect(map?.campaign_id).toBe(campaign!.id)
    expect(map?.created_by).toBe(dm.userId)
  })

  it('rejects a non-DM member creating a battle map', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'Ashfall Ridge' })
      .single()) as RpcSingleResult<Campaign>
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaign!.id })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', { p_code: invitation!.code })

    const { error } = await player.client.rpc('create_battle_map', {
      p_campaign_id: campaign!.id,
      p_name: 'Should Not Exist',
    })

    expect(error).not.toBeNull()
  })

  it('lets a fellow campaign member (not just the DM) read a battle map', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'Duskmere Hollow' })
      .single()) as RpcSingleResult<Campaign>
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaign!.id })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', { p_code: invitation!.code })
    await dm.client.rpc('create_battle_map', { p_campaign_id: campaign!.id, p_name: 'Hollow — Overview' })

    const { data: maps, error } = await player.client
      .from('battle_maps')
      .select('*')
      .eq('campaign_id', campaign!.id)

    expect(error).toBeNull()
    expect(maps).toHaveLength(1)
    expect(maps?.[0]?.name).toBe('Hollow — Overview')
  })
})
```

- [ ] **Step 4: Run the integration test**

```bash
npx supabase status   # copy ANON_KEY / SERVICE_ROLE_KEY
SUPABASE_SERVICE_ROLE_KEY=<key> SUPABASE_ANON_KEY=<key> npm run test:db
```

Expected: PASS, 7 tests total (4 existing from `campaigns.rpc.test.ts` + 3 new).

- [ ] **Step 5: Run the full unit suite and build to confirm no regressions**

```bash
npm test
npm run build
```

Expected: same counts as before this task (123 tests), zero TypeScript errors — this task touches no `src/` files.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0003_battle_maps.sql tests/integration/battle-maps.rpc.test.ts
git commit -m "Add battle_maps schema, RLS, and create_battle_map RPC"
```

---

### Task 2: Battle Map API layer

**Files:**
- Create: `app/src/battle-maps/api.ts`
- Create: `app/src/battle-maps/api.test.ts`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabaseClient` (existing)
- Produces: `type BattleMap = { id: string; campaign_id: string; name: string; created_by: string; created_at: string }`, `createBattleMap(campaignId: string, name: string): Promise<BattleMap>`, `listCampaignBattleMaps(campaignId: string): Promise<BattleMap[]>`, `getBattleMap(mapId: string): Promise<BattleMap | null>` (returns `null` on a not-found row rather than throwing, so Task 4's page can render a clean "not found" state). Task 3 imports `createBattleMap`/`listCampaignBattleMaps`/`BattleMap`; Task 4 imports `getBattleMap`/`BattleMap`.

- [ ] **Step 1: Write the failing tests**

Create `app/src/battle-maps/api.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

import { supabase } from '../lib/supabaseClient'
import { createBattleMap, getBattleMap, listCampaignBattleMaps } from './api'

const FIXTURE_MAP = {
  id: 'map-1',
  campaign_id: 'campaign-1',
  name: 'Keep — Ground Floor',
  created_by: 'user-1',
  created_at: 'now',
}

describe('createBattleMap', () => {
  it('calls the create_battle_map RPC with the campaign id and name', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: FIXTURE_MAP, error: null } as never)

    const result = await createBattleMap('campaign-1', 'Keep — Ground Floor')

    expect(supabase.rpc).toHaveBeenCalledWith('create_battle_map', {
      p_campaign_id: 'campaign-1',
      p_name: 'Keep — Ground Floor',
    })
    expect(result).toEqual(FIXTURE_MAP)
  })

  it('throws when the RPC returns an error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Only the current DM can create a battle map for this campaign' },
    } as never)

    await expect(createBattleMap('campaign-1', 'Nope')).rejects.toThrow(
      'Only the current DM can create a battle map for this campaign',
    )
  })
})

describe('listCampaignBattleMaps', () => {
  it('selects battle maps for the given campaign, ordered by creation', async () => {
    const order = vi.fn().mockResolvedValue({ data: [FIXTURE_MAP], error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    vi.mocked(supabase.from).mockReturnValue({ select } as never)

    const result = await listCampaignBattleMaps('campaign-1')

    expect(supabase.from).toHaveBeenCalledWith('battle_maps')
    expect(select).toHaveBeenCalledWith('*')
    expect(eq).toHaveBeenCalledWith('campaign_id', 'campaign-1')
    expect(result).toEqual([FIXTURE_MAP])
  })
})

describe('getBattleMap', () => {
  it('returns the battle map when found', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: FIXTURE_MAP, error: null })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    vi.mocked(supabase.from).mockReturnValue({ select } as never)

    const result = await getBattleMap('map-1')

    expect(supabase.from).toHaveBeenCalledWith('battle_maps')
    expect(eq).toHaveBeenCalledWith('id', 'map-1')
    expect(result).toEqual(FIXTURE_MAP)
  })

  it('returns null when no row matches', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    vi.mocked(supabase.from).mockReturnValue({ select } as never)

    const result = await getBattleMap('missing-map')

    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- battle-maps/api.test.ts
```

Expected: FAIL with "Cannot find module './api'".

- [ ] **Step 3: Implement the API layer**

Create `app/src/battle-maps/api.ts`:

```typescript
import { supabase } from '../lib/supabaseClient'

export type BattleMap = {
  id: string
  campaign_id: string
  name: string
  created_by: string
  created_at: string
}

export async function createBattleMap(campaignId: string, name: string): Promise<BattleMap> {
  const { data, error } = await supabase.rpc('create_battle_map', {
    p_campaign_id: campaignId,
    p_name: name,
  })
  if (error) throw new Error(error.message)
  return data as BattleMap
}

export async function listCampaignBattleMaps(campaignId: string): Promise<BattleMap[]> {
  const { data, error } = await supabase
    .from('battle_maps')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as BattleMap[]
}

export async function getBattleMap(mapId: string): Promise<BattleMap | null> {
  const { data, error } = await supabase.from('battle_maps').select('*').eq('id', mapId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as BattleMap | null) ?? null
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- battle-maps/api.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: 128 tests passing (123 + 5), zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/battle-maps/api.ts src/battle-maps/api.test.ts
git commit -m "Add Battle Map API layer (create/list/get)"
```

---

### Task 3: Battle Map list panel on the campaign dashboard

**Files:**
- Create: `app/src/battle-maps/BattleMapListPanel.tsx`
- Create: `app/src/battle-maps/BattleMapListPanel.test.tsx`
- Modify: `app/src/campaigns/CampaignDashboardPage.tsx`

**Interfaces:**
- Consumes: `BattleMap`, `createBattleMap`, `listCampaignBattleMaps` from `../battle-maps/api` (Task 2)
- Produces: `<BattleMapListPanel campaignId={string} />`, rendered from `CampaignDashboardPage`. Each listed map links to `/campaigns/:campaignId/maps/:mapId` (Task 4 builds that route).

- [ ] **Step 1: Write the failing test**

Create `app/src/battle-maps/BattleMapListPanel.test.tsx`:

```typescript
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())

vi.mock('./api', () => ({
  listCampaignBattleMaps: vi.fn().mockResolvedValue([
    { id: 'map-1', campaign_id: 'campaign-1', name: 'Keep — Ground Floor', created_by: 'u1', created_at: 'now' },
  ]),
  createBattleMap: vi.fn().mockResolvedValue({
    id: 'map-2',
    campaign_id: 'campaign-1',
    name: 'Keep — Cellar',
    created_by: 'u1',
    created_at: 'now',
  }),
}))

import { BattleMapListPanel } from './BattleMapListPanel'

describe('BattleMapListPanel', () => {
  it('lists existing battle maps, each linking to its viewer route', async () => {
    render(
      <MemoryRouter>
        <BattleMapListPanel campaignId="campaign-1" />
      </MemoryRouter>,
    )

    const link = await screen.findByRole('link', { name: /keep — ground floor/i })
    expect(link).toHaveAttribute('href', '/campaigns/campaign-1/maps/map-1')
  })

  it('creates a new battle map and shows it in the list', async () => {
    render(
      <MemoryRouter>
        <BattleMapListPanel campaignId="campaign-1" />
      </MemoryRouter>,
    )

    await screen.findByRole('link', { name: /keep — ground floor/i })

    fireEvent.change(screen.getByLabelText(/map name/i), { target: { value: 'Keep — Cellar' } })
    fireEvent.click(screen.getByRole('button', { name: /create map/i }))

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /keep — cellar/i })).toBeInTheDocument(),
    )
  })

  it('shows an error message when creating a battle map fails', async () => {
    const { createBattleMap } = await import('./api')
    vi.mocked(createBattleMap).mockRejectedValueOnce(
      new Error('Only the current DM can create a battle map for this campaign'),
    )

    render(
      <MemoryRouter>
        <BattleMapListPanel campaignId="campaign-1" />
      </MemoryRouter>,
    )

    await screen.findByRole('link', { name: /keep — ground floor/i })
    fireEvent.change(screen.getByLabelText(/map name/i), { target: { value: 'Nope' } })
    fireEvent.click(screen.getByRole('button', { name: /create map/i }))

    expect(
      await screen.findByText(/only the current dm can create a battle map/i),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- BattleMapListPanel.test.tsx
```

Expected: FAIL with "Cannot find module './BattleMapListPanel'".

- [ ] **Step 3: Implement `BattleMapListPanel`**

Create `app/src/battle-maps/BattleMapListPanel.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { type BattleMap, createBattleMap, listCampaignBattleMaps } from './api'

type BattleMapListPanelProps = {
  campaignId: string
}

export function BattleMapListPanel({ campaignId }: BattleMapListPanelProps) {
  const [maps, setMaps] = useState<BattleMap[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listCampaignBattleMaps(campaignId).then(setMaps)
  }, [campaignId])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const map = await createBattleMap(campaignId, name)
      setMaps((current) => [map, ...current])
      setName('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="battle-map-list-panel">
      <h2>Battle Maps</h2>
      <ul>
        {maps.map((map) => (
          <li key={map.id}>
            <Link to={`/campaigns/${campaignId}/maps/${map.id}`}>{map.name}</Link>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreate}>
        <label htmlFor="battle-map-name">Map name</label>
        <input id="battle-map-name" value={name} onChange={(event) => setName(event.target.value)} required />
        <button type="submit">Create map</button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </section>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- BattleMapListPanel.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Render the panel from the campaign dashboard**

Modify `app/src/campaigns/CampaignDashboardPage.tsx`:

```typescript
import { useParams } from 'react-router'
import { BattleMapListPanel } from '../battle-maps/BattleMapListPanel'
import { InvitePanel } from './InvitePanel'

export function CampaignDashboardPage() {
  const { campaignId } = useParams()

  if (!campaignId) return null

  return (
    <main className="campaign-dashboard-page">
      <h1>Campaign Dashboard</h1>
      <p>Campaign ID: {campaignId}</p>
      <InvitePanel campaignId={campaignId} />
      <BattleMapListPanel campaignId={campaignId} />
      <p>Session and Rules Content Editor views are not built yet.</p>
    </main>
  )
}
```

- [ ] **Step 6: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: 131 tests passing (128 + 3), zero TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/battle-maps/BattleMapListPanel.tsx src/battle-maps/BattleMapListPanel.test.tsx src/campaigns/CampaignDashboardPage.tsx
git commit -m "Add Battle Map list panel to the campaign dashboard"
```

---

### Task 4: Battle Map viewer route (data fetching + loading/error states)

**Files:**
- Create: `app/src/battle-maps/BattleMapPage.tsx`
- Create: `app/src/battle-maps/BattleMapPage.test.tsx`
- Modify: `app/src/router.tsx`

**Interfaces:**
- Consumes: `getBattleMap`, `BattleMap` from `./api` (Task 2)
- Produces: route `/campaigns/:campaignId/maps/:mapId` rendering `BattleMapPage`, which — once the map is loaded — renders `<BattleMapView />` (Task 5; stub it as a simple placeholder `<div>` in this task's own test, since Task 5 doesn't exist yet when this task is built — see Step 3's note).

- [ ] **Step 1: Write the failing tests**

Create `app/src/battle-maps/BattleMapPage.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => ({
  getBattleMap: vi.fn(),
}))

vi.mock('../battle-map/BattleMapView', () => ({
  BattleMapView: () => <div data-testid="battle-map-view" />,
}))

import { getBattleMap } from './api'
import { BattleMapPage } from './BattleMapPage'

function renderAt(mapId: string) {
  return render(
    <MemoryRouter initialEntries={[`/campaigns/campaign-1/maps/${mapId}`]}>
      <Routes>
        <Route path="/campaigns/:campaignId/maps/:mapId" element={<BattleMapPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BattleMapPage', () => {
  it('shows the map name and mounts the 3D viewer once loaded', async () => {
    vi.mocked(getBattleMap).mockResolvedValue({
      id: 'map-1',
      campaign_id: 'campaign-1',
      name: 'Keep — Ground Floor',
      created_by: 'u1',
      created_at: 'now',
    })

    renderAt('map-1')

    expect(await screen.findByRole('heading', { name: /keep — ground floor/i })).toBeInTheDocument()
    expect(screen.getByTestId('battle-map-view')).toBeInTheDocument()
  })

  it('shows a not-found message when no map matches the id', async () => {
    vi.mocked(getBattleMap).mockResolvedValue(null)

    renderAt('missing-map')

    expect(await screen.findByText(/battle map not found/i)).toBeInTheDocument()
    expect(screen.queryByTestId('battle-map-view')).not.toBeInTheDocument()
  })
})
```

Note: this test mocks `../battle-map/BattleMapView` — Task 5 creates that file. Since tasks in this plan are implemented in order (1→5), by the time this test file is committed the mock target doesn't exist as real code yet, which is fine: Vitest's `vi.mock` replaces the module regardless of whether you've built the real one, so this test is self-contained and passes on its own. Task 5 does not need to modify this test file.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- BattleMapPage.test.tsx
```

Expected: FAIL with "Cannot find module './BattleMapPage'".

- [ ] **Step 3: Implement `BattleMapPage`**

Create `app/src/battle-maps/BattleMapPage.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { BattleMapView } from '../battle-map/BattleMapView'
import { type BattleMap, getBattleMap } from './api'

export function BattleMapPage() {
  const { mapId } = useParams()
  const [map, setMap] = useState<BattleMap | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!mapId) return
    setLoading(true)
    void getBattleMap(mapId).then((result) => {
      setMap(result)
      setLoading(false)
    })
  }, [mapId])

  if (loading) return <div>Loading map...</div>
  if (!map) return <div>Battle map not found.</div>

  return (
    <main className="battle-map-page">
      <h1>{map.name}</h1>
      <BattleMapView />
    </main>
  )
}
```

This imports `BattleMapView` from `../battle-map/BattleMapView`, which does not exist until Task 5. That's fine for `npm test` (the test file above mocks the module, so Vitest never needs the real file to resolve) but **`npm run build` will fail** after this step until Task 5 creates the real file — this is expected and step 5 below accounts for it.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- BattleMapPage.test.tsx
```

Expected: PASS, 2 tests. (`npm test` overall will also still pass — Vitest doesn't type-check or resolve real modules behind a `vi.mock`.)

- [ ] **Step 5: Wire the route**

Modify `app/src/router.tsx` — add the new route as a sibling of `/campaigns/:campaignId`:

```typescript
import type { RouteObject } from 'react-router'
import { Navigate, Outlet, useLocation } from 'react-router'
import { LoginPage } from './auth/LoginPage'
import { useAuthSession } from './auth/useAuthSession'
import { BattleMapPage } from './battle-maps/BattleMapPage'
import { CampaignDashboardPage } from './campaigns/CampaignDashboardPage'
import { CampaignListPage } from './campaigns/CampaignListPage'
import { JoinCampaignPage } from './campaigns/JoinCampaignPage'
import { NewCampaignPage } from './campaigns/NewCampaignPage'

function RequireAuth() {
  const { session, loading } = useAuthSession()
  const location = useLocation()

  if (loading) return <div>Loading...</div>
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <Outlet />
}

export const routeConfig: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: '/campaigns', element: <CampaignListPage /> },
      { path: '/campaigns/new', element: <NewCampaignPage /> },
      { path: '/campaigns/:campaignId', element: <CampaignDashboardPage /> },
      { path: '/campaigns/:campaignId/maps/:mapId', element: <BattleMapPage /> },
      { path: '/join/:code', element: <JoinCampaignPage /> },
    ],
  },
]
```

- [ ] **Step 6: Confirm expected state — build fails until Task 5, unit tests don't**

```bash
npm test
```

Expected: PASS — count grows to 133 (131 + 2). Do NOT run `npm run build` as a gate for this task's commit; it will fail on the missing `../battle-map/BattleMapView` module until Task 5 exists. This is the one task in this plan where that's expected and correct — say so explicitly in your task report so a reviewer doesn't mistake it for a regression.

- [ ] **Step 7: Commit**

```bash
git add src/battle-maps/BattleMapPage.tsx src/battle-maps/BattleMapPage.test.tsx src/router.tsx
git commit -m "Add Battle Map viewer route with loading/not-found states"
```

---

### Task 5: `BattleMapView` — production 3D viewer

**Files:**
- Create: `app/src/battle-map/BattleMapView.tsx`
- Create: `app/src/battle-map/BattleMapView.test.tsx`

**Interfaces:**
- Consumes: `BattleMapScene` from `./scene/BattleMapScene` (existing, unchanged)
- Produces: `<BattleMapView />` — mounted by `BattleMapPage` (Task 4). This is the last task in this plan; nothing later consumes anything new from it.

- [ ] **Step 1: Write the failing test**

Create `app/src/battle-map/BattleMapView.test.tsx`. This follows the exact same `@react-three/test-renderer` pattern as the existing `app/src/battle-map/scene/BattleMapScene.test.tsx` (default export, `beforeEach` resets the `useBattleMapView` store, `renderer.unmount()` at the end) rather than jsdom/RTL, since this renders a real `<Canvas>` tree:

```typescript
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { beforeEach, expect, it } from 'vitest'
import { useBattleMapView } from './state/useBattleMapView'
import { BattleMapView } from './BattleMapView'

beforeEach(() => {
  useBattleMapView.setState(useBattleMapView.getInitialState(), true)
})

it('mounts the battle map scene with no tokens or terrain data', async () => {
  const renderer = await ReactThreeTestRenderer.create(<BattleMapView />)

  expect(renderer.scene.findByProps({ name: 'procedural-grid' }).type).toBe('Mesh')
  expect(renderer.scene.findByProps({ name: 'token-layer' }).type).toBe('Group')
  expect(renderer.scene.findByProps({ name: 'token-layer' }).children).toHaveLength(0)

  await renderer.unmount()
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- BattleMapView.test.tsx
```

Expected: FAIL with "Cannot find module './BattleMapView'".

- [ ] **Step 3: Implement `BattleMapView`**

Create `app/src/battle-map/BattleMapView.tsx`. This is deliberately minimal — no viewer-mode URL params, no stress-test machinery, no diagnostic `<output>` elements (all of that is `BattleMapCanvas`-specific dev/test tooling, not needed here). It reuses the same `Canvas`/orthographic-camera/`MapControls` configuration values as `BattleMapCanvas.tsx` (same starting `position`/`rotation`/`zoom`/`target`, so the map looks the same as it does in the validated prototype) but with a much smaller, self-contained camera component:

```typescript
import { MapControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useRef } from 'react'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import { BattleMapScene } from './scene/BattleMapScene'

function BattleMapCameraControls() {
  const controls = useRef<MapControlsImpl>(null)
  return (
    <MapControls
      ref={controls}
      target={[100, 0, 100]}
      enableDamping={false}
      enableRotate={false}
      minZoom={4}
      maxZoom={36}
      zoomSpeed={24}
      screenSpacePanning={false}
    />
  )
}

export function BattleMapView() {
  return (
    <div className="battle-map-view">
      <Canvas
        orthographic
        frameloop="demand"
        camera={{ position: [100, 150, 160], rotation: [-1.19, 0, 0], zoom: 4 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#171a1f']} />
        <BattleMapCameraControls />
        <BattleMapScene />
      </Canvas>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- BattleMapView.test.tsx
```

Expected: PASS, 1 test.

- [ ] **Step 5: Run the full suite and build — this is the first point in this plan where `npm run build` is expected to be clean again**

```bash
npm test
npm run build
```

Expected: 134 tests passing (133 + 1), zero TypeScript errors — `BattleMapPage`'s import of `../battle-map/BattleMapView` now resolves to a real file, closing the gap Task 4 knowingly left open.

- [ ] **Step 6: Commit**

```bash
git add src/battle-map/BattleMapView.tsx src/battle-map/BattleMapView.test.tsx
git commit -m "Add production BattleMapView component"
```

---

## Post-plan state

After Task 5, a DM can open a Campaign, create a named Battle Map, and any campaign member (DM or player) can click into it and see a real, empty 2.5D battle-map scene rendered by the same Three.js/React-Three-Fiber pipeline validated in the original rendering spike — proving the data-to-3D-scene path works end to end. Still not built: terrain/wall placement (`DimensionalTerrain` stays hardcoded fixture geometry), token placement and movement, per-viewer fog of war fed by real data, live Session state, and the DM Prep "Session Plan" staging flow — each is its own future plan, scoped to one remaining Wayfinder-resolved subsystem (issues #6 Tactical Rules Automation, #7 Rules Content Editor, #8 AI generation, #9 realtime session state).
