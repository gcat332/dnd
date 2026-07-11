# Taleforge Battle Map Terrain Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Battle Map terrain data-driven — a DM can add and remove rectangular terrain blocks (walls, platforms, pillars) on a Battle Map through an editor panel, the blocks persist on the `battle_maps` row, and they render live in the real 2.5D scene. This replaces the four hardcoded demo terrain fixtures with per-map data, so two different Battle Maps can finally look different.

**Architecture:** A `terrain jsonb` column on `battle_maps` (Campaign-scoped, edited as one cohesive blob per map — a JSONB column, not a separate table, because a map's terrain is always loaded and saved together with the map and is never queried across maps). Terrain is a list of `TerrainFeature` records — each an axis-aligned box placed on integer grid cells with a footprint and a height. A pure TypeScript module owns the feature shape, validation, and the grid→world-geometry conversion; the existing `DimensionalTerrain` R3F component becomes data-driven off that; writes go through a DM-only `SECURITY DEFINER` RPC, same gateway pattern as `create_battle_map`.

**Tech Stack:** Same as the rest of the app (Vite, React 19, TypeScript, Vitest, `@supabase/supabase-js`, `react-router`, Three.js/`@react-three/fiber`, `@react-three/test-renderer` for scene tests). No new dependencies.

## Global Constraints

- Terrain is Campaign-scoped via its `battle_maps` row — no `session_id`, no cross-map sharing (matches Wayfinder issue #4: Battle Map is a reusable Campaign-level resource).
- Terrain edits are a DM-only write via a `SECURITY DEFINER` RPC (`set_battle_map_terrain`), same gateway pattern as `create_battle_map` in `0003_battle_maps.sql`. Reads ride the existing `battle_maps` SELECT RLS policy (any campaign member) — no new read policy needed.
- Migrations are append-only: this plan adds `0004_battle_map_terrain.sql`; it must never edit `0001`/`0002`/`0003`. Include inline `GRANT EXECUTE` for the new RPC to `authenticated` (a hosted Supabase project revokes Data API privileges on new objects by default — established in the Foundation plan's `0002_grants.sql`, applied again in `0003`).
- The grid coordinate space is the fixed global `MAP_SIZE_CELLS = 200` (`app/src/battle-map/domain/grid.ts:1`). One grid cell = one world unit (the existing `DimensionalTerrain` boxes already use this 1-cell-per-unit convention). Terrain features are constrained to integer cell coordinates and must stay fully within `[0, 200)` on both axes.
- `DimensionalTerrain` has exactly one caller — `BattleMapScene` (`app/src/battle-map/scene/BattleMapScene.tsx:159`). Its existing `stressWalls` prop (used only by the orphaned dev-harness `BattleMapCanvas`) must keep working; this plan adds a `features` prop alongside it and removes the four hardcoded demo boxes.
- **Not in scope / do not touch:** the orphaned Playwright e2e suite (`app/tests/e2e/*.spec.ts`) targets `/` expecting the dev-harness `BattleMapCanvas`, but `/` now renders the router's login page (`BattleMapCanvas` is mounted by nothing since the Foundation merge). That suite is already stale and this plan neither runs, fixes, nor relies on it — verification here is `npm test` (Vitest), `npm run build`, and `npm run test:db`. Do not attempt to run `npm run test:e2e`.
- No in-3D-scene click/drag placement of terrain in this plan — the editor is a form + list panel beside the map (pick kind + cell + size, Add; a list with Remove). Interactive 3D placement is a much larger interaction-design task, deliberately deferred.
- No placeholder/mock **data** ships — every UI reads/writes the real Supabase project; mocking `../lib/supabaseClient` inside a unit test is expected TDD isolation, not a violation.

---

## File Structure

```
app/
  supabase/migrations/
    0004_battle_map_terrain.sql       # terrain column + set_battle_map_terrain RPC + grant (Task 2)
  tests/integration/
    battle-map-terrain.rpc.test.ts     # real Postgres integration test (Task 2)
  src/
    battle-maps/
      terrain.ts                       # TerrainFeature model, validation, grid→world geometry (Task 1)
      terrain.test.ts
      api.ts                           # modified: BattleMap gains terrain; setBattleMapTerrain added (Task 3)
      api.test.ts                      # modified
      TerrainEditorPanel.tsx            # DM add/remove terrain form + list (Task 5)
      TerrainEditorPanel.test.tsx
      BattleMapPage.tsx                 # modified: fetch terrain, pass to view, render editor (Task 5)
      BattleMapPage.test.tsx            # modified
    battle-map/
      BattleMapView.tsx                 # modified: accept + forward terrain features (Task 4)
      BattleMapView.test.tsx            # modified
      scene/
        BattleMapScene.tsx              # modified: accept + forward terrain features (Task 4)
        DimensionalTerrain.tsx          # modified: data-driven off features, drop hardcoded boxes (Task 4)
        DimensionalTerrain.test.tsx     # new (Task 4)
```

---

### Task 1: Terrain domain model, validation, and grid→world geometry

**Files:**
- Create: `app/src/battle-maps/terrain.ts`
- Create: `app/src/battle-maps/terrain.test.ts`

**Interfaces:**
- Consumes: nothing (pure module)
- Produces: `type TerrainKind = 'wall' | 'platform' | 'pillar'`; `type TerrainFeature = { id: string; kind: TerrainKind; column: number; row: number; widthCells: number; depthCells: number; heightCells: number }`; `MAX_TERRAIN_FEATURES = 500`; `isValidTerrainFeature(value: unknown): value is TerrainFeature`; `parseTerrainFeatures(value: unknown): TerrainFeature[]` (coerces an unknown JSON value to a clean array, dropping anything invalid); `terrainFeatureBox(feature: TerrainFeature): { position: [number, number, number]; scale: [number, number, number] }` (grid → world-space box). Tasks 3/4/5 import these.

- [ ] **Step 1: Write the failing tests**

Create `app/src/battle-maps/terrain.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  isValidTerrainFeature,
  MAX_TERRAIN_FEATURES,
  parseTerrainFeatures,
  terrainFeatureBox,
  type TerrainFeature,
} from './terrain'

const WALL: TerrainFeature = {
  id: 'f1',
  kind: 'wall',
  column: 90,
  row: 93,
  widthCells: 18,
  depthCells: 1,
  heightCells: 3,
}

describe('isValidTerrainFeature', () => {
  it('accepts a well-formed feature fully on the map', () => {
    expect(isValidTerrainFeature(WALL)).toBe(true)
  })

  it('rejects an unknown kind', () => {
    expect(isValidTerrainFeature({ ...WALL, kind: 'moat' })).toBe(false)
  })

  it('rejects non-integer or negative cell coordinates', () => {
    expect(isValidTerrainFeature({ ...WALL, column: 1.5 })).toBe(false)
    expect(isValidTerrainFeature({ ...WALL, row: -1 })).toBe(false)
  })

  it('rejects a footprint that runs off the 200x200 map', () => {
    expect(isValidTerrainFeature({ ...WALL, column: 199, widthCells: 5 })).toBe(false)
    expect(isValidTerrainFeature({ ...WALL, row: 199, depthCells: 5 })).toBe(false)
  })

  it('rejects non-positive sizes', () => {
    expect(isValidTerrainFeature({ ...WALL, widthCells: 0 })).toBe(false)
    expect(isValidTerrainFeature({ ...WALL, heightCells: 0 })).toBe(false)
  })
})

describe('parseTerrainFeatures', () => {
  it('returns [] for non-array input', () => {
    expect(parseTerrainFeatures(null)).toEqual([])
    expect(parseTerrainFeatures({})).toEqual([])
    expect(parseTerrainFeatures('nope')).toEqual([])
  })

  it('keeps valid features and drops invalid ones', () => {
    const result = parseTerrainFeatures([WALL, { kind: 'moat' }, 42, { ...WALL, id: 'f2' }])
    expect(result).toEqual([WALL, { ...WALL, id: 'f2' }])
  })

  it('caps at MAX_TERRAIN_FEATURES', () => {
    const many = Array.from({ length: MAX_TERRAIN_FEATURES + 10 }, (_, i) => ({ ...WALL, id: `f${i}` }))
    expect(parseTerrainFeatures(many)).toHaveLength(MAX_TERRAIN_FEATURES)
  })
})

describe('terrainFeatureBox', () => {
  it('centers the box on its footprint and rests it on the floor', () => {
    // WALL: NW corner (90,93), 18x1 footprint, height 3.
    // center x = 90 + 18/2 = 99, center z = 93 + 1/2 = 93.5, y = height/2 = 1.5
    expect(terrainFeatureBox(WALL)).toEqual({
      position: [99, 1.5, 93.5],
      scale: [18, 3, 1],
    })
  })

  it('handles a single-cell pillar', () => {
    const pillar: TerrainFeature = {
      id: 'p1',
      kind: 'pillar',
      column: 100,
      row: 100,
      widthCells: 1,
      depthCells: 1,
      heightCells: 4,
    }
    expect(terrainFeatureBox(pillar)).toEqual({
      position: [100.5, 2, 100.5],
      scale: [1, 4, 1],
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd app
npm test -- battle-maps/terrain.test.ts
```

Expected: FAIL with "Cannot find module './terrain'".

- [ ] **Step 3: Implement `terrain.ts`**

Create `app/src/battle-maps/terrain.ts`:

```typescript
import { MAP_SIZE_CELLS } from '../battle-map/domain/grid'

export const TERRAIN_KINDS = ['wall', 'platform', 'pillar'] as const
export type TerrainKind = (typeof TERRAIN_KINDS)[number]

export type TerrainFeature = {
  id: string
  kind: TerrainKind
  column: number
  row: number
  widthCells: number
  depthCells: number
  heightCells: number
}

export const MAX_TERRAIN_FEATURES = 500

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function isValidTerrainFeature(value: unknown): value is TerrainFeature {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || value.id.length === 0) return false
  if (!TERRAIN_KINDS.includes(value.kind as TerrainKind)) return false
  if (!isNonNegativeInt(value.column) || !isNonNegativeInt(value.row)) return false
  if (!isPositiveInt(value.widthCells) || !isPositiveInt(value.depthCells)) return false
  if (!isPositiveInt(value.heightCells)) return false
  if (value.column + value.widthCells > MAP_SIZE_CELLS) return false
  if (value.row + value.depthCells > MAP_SIZE_CELLS) return false
  return true
}

export function parseTerrainFeatures(value: unknown): TerrainFeature[] {
  if (!Array.isArray(value)) return []
  const features: TerrainFeature[] = []
  for (const candidate of value) {
    if (features.length >= MAX_TERRAIN_FEATURES) break
    if (isValidTerrainFeature(candidate)) features.push(candidate)
  }
  return features
}

export function terrainFeatureBox(feature: TerrainFeature): {
  position: [number, number, number]
  scale: [number, number, number]
} {
  return {
    position: [
      feature.column + feature.widthCells / 2,
      feature.heightCells / 2,
      feature.row + feature.depthCells / 2,
    ],
    scale: [feature.widthCells, feature.heightCells, feature.depthCells],
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- battle-maps/terrain.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: 148 tests passing (138 + 10), zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/battle-maps/terrain.ts src/battle-maps/terrain.test.ts
git commit -m "Add terrain feature model, validation, and grid-to-world geometry"
```

---

### Task 2: `terrain` column and `set_battle_map_terrain` RPC

**Files:**
- Create: `app/supabase/migrations/0004_battle_map_terrain.sql`
- Create: `app/tests/integration/battle-map-terrain.rpc.test.ts`

**Interfaces:**
- Consumes: `public.battle_maps` and `public.campaigns` (from `0003_battle_maps.sql`)
- Produces: `battle_maps.terrain jsonb not null default '[]'`; RPC `set_battle_map_terrain(p_map_id uuid, p_terrain jsonb) returns public.battle_maps` — DM-only (checks the map's campaign's `dm_user_id = auth.uid()`), validates `p_terrain` is a JSON array, overwrites the column, returns the updated row. Task 3's `api.ts` calls this by exact name/params.

**Prerequisite:** Docker running + `npx supabase start` (the local stack from earlier plans).

- [ ] **Step 1: Write the migration**

Create `app/supabase/migrations/0004_battle_map_terrain.sql`:

```sql
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
```

- [ ] **Step 2: Apply the migration locally**

```bash
cd app
npx supabase status   # confirm the stack is up; npx supabase start if not
npx supabase db reset
```

Expected: "Finished supabase db reset" with no SQL errors (re-applies 0001–0004).

- [ ] **Step 3: Write the integration test**

Create `app/tests/integration/battle-map-terrain.rpc.test.ts` — follows the same two-user pattern as `battle-maps.rpc.test.ts` (same `createTestUserClient` helper, same env var contract, same cascade-safe `afterAll` cleanup deleting the DM's campaigns first):

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

type Campaign = { id: string }
type BattleMap = { id: string; terrain: unknown }
type RpcSingleResult<T> = { data: T | null; error: { message: string } | null }

const SAMPLE_TERRAIN = [
  { id: 'f1', kind: 'wall', column: 90, row: 93, widthCells: 18, depthCells: 1, heightCells: 3 },
]

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

describe('set_battle_map_terrain RPC', () => {
  let dm: Awaited<ReturnType<typeof createTestUserClient>>
  let player: Awaited<ReturnType<typeof createTestUserClient>>

  beforeAll(async () => {
    dm = await createTestUserClient(`dm-${Date.now()}@example.test`)
    player = await createTestUserClient(`player-${Date.now()}@example.test`)
  })

  afterAll(async () => {
    const { error: campaignsError } = await adminClient
      .from('campaigns')
      .delete()
      .eq('dm_user_id', dm.userId)
    if (campaignsError) throw campaignsError
    const { error: dmError } = await adminClient.auth.admin.deleteUser(dm.userId)
    if (dmError) throw dmError
    const { error: playerError } = await adminClient.auth.admin.deleteUser(player.userId)
    if (playerError) throw playerError
  })

  it('lets the DM set terrain and reads it back', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'Terrain Test' })
      .single()) as RpcSingleResult<Campaign>
    const { data: map } = (await dm.client
      .rpc('create_battle_map', { p_campaign_id: campaign!.id, p_name: 'Map A' })
      .single()) as RpcSingleResult<BattleMap>

    const { data: updated, error } = (await dm.client
      .rpc('set_battle_map_terrain', { p_map_id: map!.id, p_terrain: SAMPLE_TERRAIN })
      .single()) as RpcSingleResult<BattleMap>

    expect(error).toBeNull()
    expect(updated?.terrain).toEqual(SAMPLE_TERRAIN)
  })

  it('rejects a non-DM member editing terrain', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'Terrain Test 2' })
      .single()) as RpcSingleResult<Campaign>
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaign!.id })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', { p_code: (invitation as { code: string }).code })
    const { data: map } = (await dm.client
      .rpc('create_battle_map', { p_campaign_id: campaign!.id, p_name: 'Map B' })
      .single()) as RpcSingleResult<BattleMap>

    const { error } = await player.client.rpc('set_battle_map_terrain', {
      p_map_id: map!.id,
      p_terrain: SAMPLE_TERRAIN,
    })

    expect(error).not.toBeNull()
  })

  it('rejects a non-array terrain payload', async () => {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: 'Terrain Test 3' })
      .single()) as RpcSingleResult<Campaign>
    const { data: map } = (await dm.client
      .rpc('create_battle_map', { p_campaign_id: campaign!.id, p_name: 'Map C' })
      .single()) as RpcSingleResult<BattleMap>

    const { error } = await dm.client.rpc('set_battle_map_terrain', {
      p_map_id: map!.id,
      p_terrain: { not: 'an array' },
    })

    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 4: Run the integration test**

```bash
npx supabase status   # copy ANON_KEY / SERVICE_ROLE_KEY
SUPABASE_SERVICE_ROLE_KEY=<key> SUPABASE_ANON_KEY=<key> npm run test:db
```

Expected: PASS, 10 tests (7 existing + 3 new).

- [ ] **Step 5: Run the unit suite and build**

```bash
npm test
npm run build
```

Expected: 148 tests (unchanged from Task 1 — no `src/` change here), zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0004_battle_map_terrain.sql tests/integration/battle-map-terrain.rpc.test.ts
git commit -m "Add battle_maps.terrain column and DM-only set_battle_map_terrain RPC"
```

---

### Task 3: API layer — terrain on read, `setBattleMapTerrain` on write

**Files:**
- Modify: `app/src/battle-maps/api.ts`
- Modify: `app/src/battle-maps/api.test.ts`

**Interfaces:**
- Consumes: `parseTerrainFeatures`, `TerrainFeature` from `./terrain` (Task 1); `supabase` from `../lib/supabaseClient`
- Produces: `BattleMap` type gains `terrain: TerrainFeature[]` (always a clean array — the raw JSONB is run through `parseTerrainFeatures` on read); `setBattleMapTerrain(mapId: string, features: TerrainFeature[]): Promise<BattleMap>`. Tasks 4/5 import these.

- [ ] **Step 1: Update the existing tests and add new ones**

In `app/src/battle-maps/api.test.ts`, the existing `FIXTURE_MAP` and assertions need a `terrain` field. Update the fixture and add coverage. Replace the file's fixture constant and add a `setBattleMapTerrain` describe block. The existing `createBattleMap`/`listCampaignBattleMaps`/`getBattleMap` tests stay, but their fixture rows must now carry a `terrain` array so the parse-on-read assertion holds. Concretely:

Change the top fixture (currently `const FIXTURE_MAP = { id: 'map-1', campaign_id: 'campaign-1', name: '...', created_by: 'user-1', created_at: 'now' }`) to include terrain:

```typescript
const FIXTURE_TERRAIN = [
  { id: 'f1', kind: 'wall', column: 90, row: 93, widthCells: 18, depthCells: 1, heightCells: 3 },
]
const FIXTURE_MAP = {
  id: 'map-1',
  campaign_id: 'campaign-1',
  name: 'Keep — Ground Floor',
  created_by: 'user-1',
  created_at: 'now',
  terrain: FIXTURE_TERRAIN,
}
```

Update the import line to add `setBattleMapTerrain`:

```typescript
import { createBattleMap, getBattleMap, listCampaignBattleMaps, setBattleMapTerrain } from './api'
```

Add these assertions inside the existing `getBattleMap` "returns the battle map when found" test (after the existing `expect(result).toEqual(...)`), OR as a new `it`, verifying terrain is parsed to a clean array:

```typescript
it('coerces a malformed terrain value to a clean array on read', async () => {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { ...FIXTURE_MAP, terrain: [FIXTURE_TERRAIN[0], { kind: 'bogus' }, 7] },
    error: null,
  })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  vi.mocked(supabase.from).mockReturnValue({ select } as never)

  const result = await getBattleMap('map-1')

  expect(result?.terrain).toEqual(FIXTURE_TERRAIN)
})
```

Add a new describe block for the writer:

```typescript
describe('setBattleMapTerrain', () => {
  it('calls the set_battle_map_terrain RPC and returns the parsed map', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: FIXTURE_MAP, error: null } as never)

    const result = await setBattleMapTerrain('map-1', FIXTURE_TERRAIN)

    expect(supabase.rpc).toHaveBeenCalledWith('set_battle_map_terrain', {
      p_map_id: 'map-1',
      p_terrain: FIXTURE_TERRAIN,
    })
    expect(result.terrain).toEqual(FIXTURE_TERRAIN)
  })

  it('throws when the RPC returns an error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: "Only the current DM can edit this battle map's terrain" },
    } as never)

    await expect(setBattleMapTerrain('map-1', FIXTURE_TERRAIN)).rejects.toThrow(
      'Only the current DM can edit this battle map',
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

```bash
npm test -- battle-maps/api.test.ts
```

Expected: FAIL — `setBattleMapTerrain` is not exported, and `terrain` is not yet on the returned rows.

- [ ] **Step 3: Update `api.ts`**

Modify `app/src/battle-maps/api.ts`. Add the terrain import, extend the type, run reads through `parseTerrainFeatures`, and add the writer. Full new file:

```typescript
import { supabase } from '../lib/supabaseClient'
import { parseTerrainFeatures, type TerrainFeature } from './terrain'

export type BattleMap = {
  id: string
  campaign_id: string
  name: string
  created_by: string
  created_at: string
  terrain: TerrainFeature[]
}

type RawBattleMap = Omit<BattleMap, 'terrain'> & { terrain: unknown }

function toBattleMap(raw: RawBattleMap): BattleMap {
  return { ...raw, terrain: parseTerrainFeatures(raw.terrain) }
}

export async function createBattleMap(campaignId: string, name: string): Promise<BattleMap> {
  const { data, error } = await supabase.rpc('create_battle_map', {
    p_campaign_id: campaignId,
    p_name: name,
  })
  if (error) throw new Error(error.message)
  return toBattleMap(data as RawBattleMap)
}

export async function listCampaignBattleMaps(campaignId: string): Promise<BattleMap[]> {
  const { data, error } = await supabase
    .from('battle_maps')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as RawBattleMap[]).map(toBattleMap)
}

export async function getBattleMap(mapId: string): Promise<BattleMap | null> {
  const { data, error } = await supabase.from('battle_maps').select('*').eq('id', mapId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toBattleMap(data as RawBattleMap) : null
}

export async function setBattleMapTerrain(
  mapId: string,
  features: TerrainFeature[],
): Promise<BattleMap> {
  const { data, error } = await supabase.rpc('set_battle_map_terrain', {
    p_map_id: mapId,
    p_terrain: features,
  })
  if (error) throw new Error(error.message)
  return toBattleMap(data as RawBattleMap)
}
```

Note: `createBattleMap`'s RPC (`create_battle_map`, from `0003`) returns a `battle_maps` row that now includes the `terrain` column (defaulting to `[]`), so `toBattleMap` works uniformly across all three readers. The existing `createBattleMap`/`listCampaignBattleMaps` tests' fixture rows gained a `terrain` field in Step 1, so they still pass through `toBattleMap` cleanly.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- battle-maps/api.test.ts
```

Expected: PASS (the existing tests plus the new terrain ones).

- [ ] **Step 5: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: all green (148 + the new api tests), zero TypeScript errors. Note: Task 3 changes `BattleMap`'s shape, so any other test constructing a `BattleMap` literal (e.g. `BattleMapListPanel.test.tsx`, `BattleMapPage.test.tsx` fixtures) may now fail typecheck for a missing `terrain` field — if `npm run build` reports that, add `terrain: []` to those test fixtures as part of this task (they're consumers of the type you just changed). Do not change their behavior otherwise.

- [ ] **Step 6: Commit**

```bash
git add src/battle-maps/api.ts src/battle-maps/api.test.ts
git commit -m "Thread terrain through the Battle Map API layer"
```

---

### Task 4: Make `DimensionalTerrain` data-driven

**Files:**
- Modify: `app/src/battle-map/scene/DimensionalTerrain.tsx`
- Create: `app/src/battle-map/scene/DimensionalTerrain.test.tsx`
- Modify: `app/src/battle-map/scene/BattleMapScene.tsx`
- Modify: `app/src/battle-map/BattleMapView.tsx`
- Modify: `app/src/battle-map/BattleMapView.test.tsx`

**Interfaces:**
- Consumes: `TerrainFeature`, `terrainFeatureBox` from `../../battle-maps/terrain` (Task 1)
- Produces: `DimensionalTerrain` gains a `features?: readonly TerrainFeature[]` prop and renders a box per feature (material chosen by `kind`); `BattleMapScene` gains `terrainFeatures?: readonly TerrainFeature[]` forwarded to it; `BattleMapView` gains `terrain?: readonly TerrainFeature[]` forwarded to the scene. The four hardcoded demo boxes are removed. Task 5 passes real data down this chain.

- [ ] **Step 1: Write the failing test for the data-driven `DimensionalTerrain`**

Create `app/src/battle-map/scene/DimensionalTerrain.test.tsx`:

```typescript
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { expect, it } from 'vitest'
import type { TerrainFeature } from '../../battle-maps/terrain'
import { DimensionalTerrain } from './DimensionalTerrain'

const FEATURES: readonly TerrainFeature[] = [
  { id: 'w1', kind: 'wall', column: 90, row: 93, widthCells: 18, depthCells: 1, heightCells: 3 },
  { id: 'p1', kind: 'pillar', column: 100, row: 100, widthCells: 1, depthCells: 1, heightCells: 4 },
]

it('renders one mesh per terrain feature, positioned from its grid box', async () => {
  const renderer = await ReactThreeTestRenderer.create(<DimensionalTerrain features={FEATURES} />)

  const group = renderer.scene.findByProps({ name: 'dimensional-terrain' })
  expect(group.type).toBe('Group')

  const wall = renderer.scene.findByProps({ name: 'terrain-w1' })
  // wall box: center x = 90+18/2 = 99, y = 3/2 = 1.5, z = 93+1/2 = 93.5
  expect(wall.instance.position.toArray()).toEqual([99, 1.5, 93.5])
  expect(wall.instance.scale.toArray()).toEqual([18, 3, 1])

  const pillar = renderer.scene.findByProps({ name: 'terrain-p1' })
  expect(pillar.instance.position.toArray()).toEqual([100.5, 2, 100.5])

  await renderer.unmount()
})

it('renders an empty terrain group when given no features', async () => {
  const renderer = await ReactThreeTestRenderer.create(<DimensionalTerrain />)
  const group = renderer.scene.findByProps({ name: 'dimensional-terrain' })
  expect(group.children).toHaveLength(0)
  await renderer.unmount()
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npm test -- DimensionalTerrain.test.tsx
```

Expected: FAIL — `DimensionalTerrain` doesn't accept `features` yet and the old version renders four hardcoded boxes (so the empty-group assertion fails).

- [ ] **Step 3: Rewrite `DimensionalTerrain.tsx` to be data-driven**

Replace `app/src/battle-map/scene/DimensionalTerrain.tsx` entirely:

```typescript
import { BoxGeometry, MeshStandardMaterial } from 'three'
import { terrainFeatureBox, type TerrainFeature, type TerrainKind } from '../../battle-maps/terrain'
import type { StressWall } from '../fixtures/createStressScene'

const BOX_GEOMETRY = new BoxGeometry(1, 1, 1)

const MATERIALS: Record<TerrainKind, MeshStandardMaterial> = {
  wall: new MeshStandardMaterial({ color: '#73777b', roughness: 0.88 }),
  platform: new MeshStandardMaterial({ color: '#596d50', roughness: 0.94 }),
  pillar: new MeshStandardMaterial({ color: '#d6b759', roughness: 0.65 }),
}

const STONE_MATERIAL = MATERIALS.wall

type TerrainBoxProps = {
  name: string
  position: [number, number, number]
  scale: [number, number, number]
  material: MeshStandardMaterial
}

function TerrainBox({ name, position, scale, material }: TerrainBoxProps) {
  return (
    <mesh name={name} position={position} scale={scale} castShadow receiveShadow>
      <primitive object={BOX_GEOMETRY} attach="geometry" />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

type DimensionalTerrainProps = Readonly<{
  features?: readonly TerrainFeature[]
  stressWalls?: readonly StressWall[]
}>

export function DimensionalTerrain({ features = [], stressWalls = [] }: DimensionalTerrainProps) {
  return (
    <group name="dimensional-terrain" dispose={null}>
      {features.map((feature) => {
        const box = terrainFeatureBox(feature)
        return (
          <TerrainBox
            key={feature.id}
            name={`terrain-${feature.id}`}
            position={box.position}
            scale={box.scale}
            material={MATERIALS[feature.kind]}
          />
        )
      })}
      {stressWalls.map((wall) => (
        <TerrainBox
          key={wall.id}
          name={`stress-wall-${wall.id}`}
          position={[...wall.position]}
          scale={[...wall.scale]}
          material={STONE_MATERIAL}
        />
      ))}
    </group>
  )
}
```

- [ ] **Step 4: Run the `DimensionalTerrain` test to verify it passes**

```bash
npm test -- DimensionalTerrain.test.tsx
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Thread `terrainFeatures` through `BattleMapScene`**

Modify `app/src/battle-map/scene/BattleMapScene.tsx`. Add the import, add the prop, forward it. The `TerrainFeature` import:

```typescript
import type { TerrainFeature } from '../../battle-maps/terrain'
```

Add `terrainFeatures?: readonly TerrainFeature[]` to `BattleMapSceneProps` (the type around line 66), give it a default in the destructure (around line 118: `terrainFeatures = NO_TERRAIN,` with `const NO_TERRAIN: readonly TerrainFeature[] = []` declared near the other `NO_*` consts around line 81), and change the render call (line 159) from:

```typescript
      <DimensionalTerrain stressWalls={stressWalls} />
```

to:

```typescript
      <DimensionalTerrain features={terrainFeatures} stressWalls={stressWalls} />
```

- [ ] **Step 6: Thread `terrain` through `BattleMapView`**

Modify `app/src/battle-map/BattleMapView.tsx`. Add the import and prop, forward to the scene:

```typescript
import { MapControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useRef } from 'react'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import type { TerrainFeature } from '../battle-maps/terrain'
import { BattleMapScene } from './scene/BattleMapScene'

export function BattleMapCameraControls() {
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

type BattleMapViewProps = {
  terrain?: readonly TerrainFeature[]
}

export function BattleMapView({ terrain = [] }: BattleMapViewProps) {
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
        <BattleMapScene terrainFeatures={terrain} />
      </Canvas>
    </div>
  )
}
```

- [ ] **Step 7: Update `BattleMapView.test.tsx` for the new composition**

The existing composition test (the third test, checking `BattleMapView()`'s element tree) asserts `<BattleMapScene />` is rendered. It now renders `<BattleMapScene terrainFeatures={[]} />` by default. Update that test's assertion so it still matches — the `sceneElement.type` check against `BattleMapScene` stays valid (the type is unchanged, only props changed), so likely no change is needed unless the test asserted on the scene element's exact (empty) props. Read the current third test and, if it asserts `sceneElement.props` is empty/specific, update it to expect `{ terrainFeatures: [] }`. If it only checks `sceneElement.type === BattleMapScene`, leave it. Run:

```bash
npm test -- BattleMapView.test.tsx
```

Expected: PASS (adjust the one composition assertion if the run shows it comparing scene props).

- [ ] **Step 8: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: all green. `BattleMapScene.test.tsx`'s existing `dimensional-terrain` group assertion still holds (the group name is unchanged). Zero TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/battle-map/scene/DimensionalTerrain.tsx src/battle-map/scene/DimensionalTerrain.test.tsx src/battle-map/scene/BattleMapScene.tsx src/battle-map/BattleMapView.tsx src/battle-map/BattleMapView.test.tsx
git commit -m "Make DimensionalTerrain render from per-map feature data"
```

---

### Task 5: Terrain editor panel on the Battle Map page

**Files:**
- Create: `app/src/battle-maps/TerrainEditorPanel.tsx`
- Create: `app/src/battle-maps/TerrainEditorPanel.test.tsx`
- Modify: `app/src/battle-maps/BattleMapPage.tsx`
- Modify: `app/src/battle-maps/BattleMapPage.test.tsx`

**Interfaces:**
- Consumes: `TerrainFeature`, `TerrainKind`, `TERRAIN_KINDS`, `isValidTerrainFeature` from `./terrain` (Task 1); `setBattleMapTerrain`, `BattleMap` from `./api` (Task 3)
- Produces: `<TerrainEditorPanel map={BattleMap} onTerrainChange={(features) => void} />` — renders the current features with Remove buttons and an add-form; on any change, calls `setBattleMapTerrain` and reports the new list up via `onTerrainChange`. `BattleMapPage` owns the terrain state so it can pass it to both `BattleMapView` (for rendering) and the panel (for editing). This is the last task.

- [ ] **Step 1: Write the failing test for `TerrainEditorPanel`**

Create `app/src/battle-maps/TerrainEditorPanel.test.tsx`:

```typescript
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BattleMap } from './api'

afterEach(() => cleanup())

vi.mock('./api', () => ({
  setBattleMapTerrain: vi.fn(),
}))

import { setBattleMapTerrain } from './api'
import { TerrainEditorPanel } from './TerrainEditorPanel'

const WALL = {
  id: 'w1',
  kind: 'wall' as const,
  column: 90,
  row: 93,
  widthCells: 18,
  depthCells: 1,
  heightCells: 3,
}

const MAP: BattleMap = {
  id: 'map-1',
  campaign_id: 'c1',
  name: 'Map A',
  created_by: 'u1',
  created_at: 'now',
  terrain: [WALL],
}

describe('TerrainEditorPanel', () => {
  it('lists existing features with a remove control', () => {
    render(<TerrainEditorPanel map={MAP} onTerrainChange={vi.fn()} />)
    expect(screen.getByText(/wall/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
  })

  it('adds a feature, persists via setBattleMapTerrain, and reports the new list up', async () => {
    vi.mocked(setBattleMapTerrain).mockResolvedValue({ ...MAP, terrain: [WALL] })
    const onTerrainChange = vi.fn()
    render(<TerrainEditorPanel map={{ ...MAP, terrain: [] }} onTerrainChange={onTerrainChange} />)

    fireEvent.change(screen.getByLabelText(/column/i), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText(/row/i), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/depth/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /add feature/i }))

    await waitFor(() => expect(setBattleMapTerrain).toHaveBeenCalledWith('map-1', expect.any(Array)))
    expect(onTerrainChange).toHaveBeenCalled()
  })

  it('shows an error when the save fails', async () => {
    vi.mocked(setBattleMapTerrain).mockRejectedValueOnce(
      new Error("Only the current DM can edit this battle map's terrain"),
    )
    render(<TerrainEditorPanel map={{ ...MAP, terrain: [] }} onTerrainChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/column/i), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText(/row/i), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText(/width/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/depth/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /add feature/i }))

    expect(await screen.findByText(/only the current dm can edit/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npm test -- TerrainEditorPanel.test.tsx
```

Expected: FAIL with "Cannot find module './TerrainEditorPanel'".

- [ ] **Step 3: Implement `TerrainEditorPanel`**

Create `app/src/battle-maps/TerrainEditorPanel.tsx`:

```typescript
import { useState } from 'react'
import { setBattleMapTerrain, type BattleMap } from './api'
import { isValidTerrainFeature, TERRAIN_KINDS, type TerrainFeature, type TerrainKind } from './terrain'

type TerrainEditorPanelProps = {
  map: BattleMap
  onTerrainChange: (features: TerrainFeature[]) => void
}

let featureCounter = 0
function nextFeatureId(): string {
  featureCounter += 1
  return `feat-${Date.now()}-${featureCounter}`
}

export function TerrainEditorPanel({ map, onTerrainChange }: TerrainEditorPanelProps) {
  const [features, setFeatures] = useState<TerrainFeature[]>(map.terrain)
  const [kind, setKind] = useState<TerrainKind>('wall')
  const [column, setColumn] = useState(0)
  const [row, setRow] = useState(0)
  const [widthCells, setWidthCells] = useState(1)
  const [depthCells, setDepthCells] = useState(1)
  const [heightCells, setHeightCells] = useState(1)
  const [error, setError] = useState<string | null>(null)

  async function persist(next: TerrainFeature[]) {
    setError(null)
    try {
      await setBattleMapTerrain(map.id, next)
      setFeatures(next)
      onTerrainChange(next)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const candidate: TerrainFeature = {
      id: nextFeatureId(),
      kind,
      column,
      row,
      widthCells,
      depthCells,
      heightCells,
    }
    if (!isValidTerrainFeature(candidate)) {
      setError('That feature does not fit on the map (check position and size).')
      return
    }
    await persist([...features, candidate])
  }

  async function handleRemove(id: string) {
    await persist(features.filter((feature) => feature.id !== id))
  }

  return (
    <section className="terrain-editor-panel">
      <h2>Terrain</h2>
      <ul>
        {features.map((feature) => (
          <li key={feature.id}>
            {feature.kind} at ({feature.column}, {feature.row}) —{' '}
            {feature.widthCells}×{feature.depthCells}, h{feature.heightCells}
            <button type="button" onClick={() => void handleRemove(feature.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd}>
        <label htmlFor="terrain-kind">Kind</label>
        <select
          id="terrain-kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as TerrainKind)}
        >
          {TERRAIN_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <label htmlFor="terrain-column">Column</label>
        <input
          id="terrain-column"
          type="number"
          value={column}
          onChange={(event) => setColumn(Number(event.target.value))}
        />
        <label htmlFor="terrain-row">Row</label>
        <input
          id="terrain-row"
          type="number"
          value={row}
          onChange={(event) => setRow(Number(event.target.value))}
        />
        <label htmlFor="terrain-width">Width</label>
        <input
          id="terrain-width"
          type="number"
          value={widthCells}
          onChange={(event) => setWidthCells(Number(event.target.value))}
        />
        <label htmlFor="terrain-depth">Depth</label>
        <input
          id="terrain-depth"
          type="number"
          value={depthCells}
          onChange={(event) => setDepthCells(Number(event.target.value))}
        />
        <label htmlFor="terrain-height">Height</label>
        <input
          id="terrain-height"
          type="number"
          value={heightCells}
          onChange={(event) => setHeightCells(Number(event.target.value))}
        />
        <button type="submit">Add feature</button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </section>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- TerrainEditorPanel.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Wire terrain state into `BattleMapPage`**

Modify `app/src/battle-maps/BattleMapPage.tsx` so it holds the loaded map's terrain in state, passes it to `BattleMapView` for rendering, and renders the editor panel (which reports edits back up so the scene re-renders live). Full new file:

```typescript
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { BattleMapView } from '../battle-map/BattleMapView'
import { type BattleMap, getBattleMap } from './api'
import type { TerrainFeature } from './terrain'
import { TerrainEditorPanel } from './TerrainEditorPanel'

export function BattleMapPage() {
  const { mapId } = useParams()
  const [map, setMap] = useState<BattleMap | null>(null)
  const [terrain, setTerrain] = useState<TerrainFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapId) return
    setLoading(true)
    getBattleMap(mapId)
      .then((result) => {
        setMap(result)
        setTerrain(result?.terrain ?? [])
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [mapId])

  if (loading) return <div>Loading map...</div>
  if (error) return <div>Couldn't load the map: {error}</div>
  if (!map) return <div>Battle map not found.</div>

  return (
    <main className="battle-map-page">
      <h1>{map.name}</h1>
      <BattleMapView terrain={terrain} />
      <TerrainEditorPanel map={map} onTerrainChange={setTerrain} />
    </main>
  )
}
```

Note the `.catch` on the load effect is carried over from the Foundation-established load-error pattern (added to this file in the Battle Map Integration plan's final review) — keep it; don't regress to a bare `.then`.

- [ ] **Step 6: Update `BattleMapPage.test.tsx`**

The existing tests mock `../battle-map/BattleMapView` and `./api`'s `getBattleMap`. Two things change: `getBattleMap`'s mocked return rows now need a `terrain` field (the `BattleMap` type requires it), and the page now also renders `TerrainEditorPanel`, which imports `setBattleMapTerrain` from `./api` — so the `./api` mock must also export `setBattleMapTerrain`. Update the `./api` mock and the fixture. Also mock `./TerrainEditorPanel` to keep this a focused page-level test (the panel has its own test file):

Add to the top-of-file mocks:

```typescript
vi.mock('./TerrainEditorPanel', () => ({
  TerrainEditorPanel: () => <div data-testid="terrain-editor-panel" />,
}))
```

Change the `./api` mock so it provides both functions the page's module graph now imports:

```typescript
vi.mock('./api', () => ({
  getBattleMap: vi.fn(),
  setBattleMapTerrain: vi.fn(),
}))
```

And every `getBattleMap` mock return that represents a found map needs `terrain: []` (or a sample array) added to satisfy the `BattleMap` type. The success-path test should additionally assert the editor panel mounts:

```typescript
expect(screen.getByTestId('terrain-editor-panel')).toBeInTheDocument()
```

- [ ] **Step 7: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: all green (the panel's 3 tests + all prior), zero TypeScript errors.

- [ ] **Step 8: Verify the terrain round-trip against the real local stack**

```bash
npx supabase status
SUPABASE_SERVICE_ROLE_KEY=<key> SUPABASE_ANON_KEY=<key> npm run test:db
```

Expected: PASS, 10 tests (the terrain integration tests from Task 2 still green — this confirms the DB layer the UI depends on is intact).

- [ ] **Step 9: Commit**

```bash
git add src/battle-maps/TerrainEditorPanel.tsx src/battle-maps/TerrainEditorPanel.test.tsx src/battle-maps/BattleMapPage.tsx src/battle-maps/BattleMapPage.test.tsx
git commit -m "Add terrain editor panel to the Battle Map page"
```

---

## Post-plan state

After Task 5, a DM opens a Battle Map, adds walls/platforms/pillars by cell position and size, removes them, and sees each change render live in the 2.5D scene and persist on the `battle_maps.terrain` column — two different maps in a campaign now look genuinely different. Still deferred (each its own future plan): interactive in-scene click/drag placement (this editor is form-based), hiding the editor from non-DM viewers (the RPC already rejects their writes, same accepted pattern as `InvitePanel`), per-viewer fog of war fed by real data, token placement/movement, live Session realtime sync (issue #9), and the rules/AI subsystems (issues #6/#7/#8). The orphaned Playwright e2e suite (targeting the unmounted `BattleMapCanvas`) remains a separate cleanup, untouched here.
