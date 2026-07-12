# Taleforge Battle Map Token Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a DM place named, colored tokens on a Battle Map, drag them to reposition, and remove them — with each token and its position persisted on the map so it survives a reload. The 2.5D renderer already draws tokens and supports drag-to-move; this plan gives that interaction real data and persistence.

**Architecture:** A `tokens` table (belongs to a Battle Map, per Wayfinder issue #4), gated the same way `battle_maps`/terrain are — RLS for member reads, DM-only `SECURITY DEFINER` RPCs for create/move/delete. A pure TypeScript model maps the persisted `Token` row to the renderer's existing `TokenRenderState`. `BattleMapPage` fetches the map's tokens, renders them through the already-built `TokenLayer`, and persists a drag via the renderer's existing `onMoveIntent` callback.

**Tech Stack:** Same as the rest of the app (Vite, React 19, TypeScript, Vitest, `@supabase/supabase-js`, `react-router`, Three.js/`@react-three/fiber`, `@react-three/test-renderer`). No new dependencies.

## Global Constraints

- Tokens are Battle-Map-scoped via a `battle_map_id` FK (Wayfinder issue #4: a Token belongs to a Battle Map). No `session_id`, no per-Session token state — that's the deferred live-session subsystem (issue #9).
- Token create/move/delete are **DM-only** writes via `SECURITY DEFINER` RPCs, gated by the token's map's campaign `dm_user_id = auth.uid()` (a `tokens → battle_maps → campaigns` join), exactly mirroring `set_battle_map_terrain` in `0004_battle_map_terrain.sql`. Reads use an RLS SELECT policy reusing `is_campaign_member`.
- **Per-player token ownership is OUT of scope.** Issue #9's model (a player controls the token linked to their Character) needs Characters, which don't exist yet. In this slice the DM owns and moves all tokens — same posture as terrain (DM-authored map content). No `character_id` link column is added; a later Character subsystem adds it.
- **Realtime multi-viewer sync is OUT of scope.** A move persists and shows on reload; it does not yet push to other connected viewers live (that's issue #9's Supabase Realtime work). Single-viewer persistence only, exactly like terrain.
- Migrations are append-only: this plan adds `0005_battle_map_tokens.sql`; it must never edit `0001`–`0004`. Include inline `GRANT`s (SELECT on the table, EXECUTE on each RPC) to `authenticated` — a hosted Supabase project revokes Data API privileges on new objects by default (established in `0002_grants.sql`, applied again in `0003`/`0004`).
- Grid space is the fixed global `MAP_SIZE_CELLS = 200` (`app/src/battle-map/domain/grid.ts:1`); token cells must be integers within `[0, 200)`.
- The renderer already provides token rendering and drag-to-move: `TokenLayer`/`TokenMesh` (`app/src/battle-map/scene/`) render a `TokenRenderState[]` and emit a `MoveIntent` via `onMoveIntent` on drag-release; `BattleMapScene` already accepts and forwards `tokens` and `onMoveIntent` props (`app/src/battle-map/scene/BattleMapScene.tsx:68-69,122-123,167-168`). Do NOT reimplement any of that — this plan feeds it data and persists its output.
- **Naming caution:** the renderer's token types live in `app/src/battle-map/domain/tokens.ts` (`TokenRenderState`, `MoveIntent`). This plan's new persistence model lives in `app/src/battle-maps/tokenModel.ts` (note the singular `battle-map/` vs plural `battle-maps/` directory split that already exists in the codebase — `battle-map/` is the renderer, `battle-maps/` is the app/data layer). The new file is named `tokenModel.ts` (not `tokens.ts`) specifically to avoid confusion with the renderer's `domain/tokens.ts`.
- No placeholder/mock **data** ships — every UI reads/writes the real Supabase project; mocking `../lib/supabaseClient` inside a unit test is expected TDD isolation, not a violation.
- Docker + local Supabase stack are needed for Tasks 2 and 5's `test:db` verification (`npx supabase start`). Tasks 1, 3, 4 are pure TS/React and need neither.

---

## File Structure

```
app/
  supabase/migrations/
    0005_battle_map_tokens.sql        # tokens table, RLS, create/move/delete RPCs, grants (Task 2)
  tests/integration/
    battle-map-tokens.rpc.test.ts      # real Postgres integration test (Task 2)
  src/
    battle-maps/
      tokenModel.ts                    # Token persistence type, validation, → TokenRenderState (Task 1)
      tokenModel.test.ts
      api.ts                           # modified: token CRUD functions added (Task 3)
      api.test.ts                      # modified
      TokenPalettePanel.tsx             # DM add-token form + list-with-remove (Task 5)
      TokenPalettePanel.test.tsx
      BattleMapPage.tsx                 # modified: fetch tokens, render, persist moves, editor (Task 4/5)
      BattleMapPage.test.tsx            # modified
    battle-map/
      BattleMapView.tsx                 # modified: accept + forward tokens + onMoveIntent (Task 4)
      BattleMapView.test.tsx            # modified
```

---

### Task 1: Token persistence model

**Files:**
- Create: `app/src/battle-maps/tokenModel.ts`
- Create: `app/src/battle-maps/tokenModel.test.ts`

**Interfaces:**
- Consumes: `MAP_SIZE_CELLS` from `../battle-map/domain/grid`; `TokenRenderState` (type only) from `../battle-map/domain/tokens`
- Produces: `type Token = { id: string; battle_map_id: string; label: string; color: string; column: number; row: number; elevation: number }`; `isTokenCellOnMap(column: number, row: number): boolean`; `tokenToRenderState(token: Token): TokenRenderState`; `parseTokens(value: unknown): Token[]` (coerces an array of raw rows to clean `Token[]`, dropping malformed entries). Tasks 3/4/5 import these.

- [ ] **Step 1: Write the failing tests**

Create `app/src/battle-maps/tokenModel.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { isTokenCellOnMap, parseTokens, tokenToRenderState, type Token } from './tokenModel'

const TOKEN: Token = {
  id: 't1',
  battle_map_id: 'map-1',
  label: 'Goblin',
  color: '#4f9e63',
  column: 100,
  row: 100,
  elevation: 0,
}

describe('isTokenCellOnMap', () => {
  it('accepts integer cells inside the 200x200 map', () => {
    expect(isTokenCellOnMap(0, 0)).toBe(true)
    expect(isTokenCellOnMap(199, 199)).toBe(true)
  })

  it('rejects out-of-range or non-integer cells', () => {
    expect(isTokenCellOnMap(200, 0)).toBe(false)
    expect(isTokenCellOnMap(0, -1)).toBe(false)
    expect(isTokenCellOnMap(1.5, 0)).toBe(false)
  })
})

describe('tokenToRenderState', () => {
  it('maps a persisted token to the renderer shape, always visible', () => {
    expect(tokenToRenderState(TOKEN)).toEqual({
      id: 't1',
      label: 'Goblin',
      cell: { column: 100, row: 100 },
      elevation: 0,
      color: '#4f9e63',
      visible: true,
    })
  })
})

describe('parseTokens', () => {
  it('returns [] for non-array input', () => {
    expect(parseTokens(null)).toEqual([])
    expect(parseTokens({})).toEqual([])
  })

  it('keeps well-formed rows and drops malformed ones', () => {
    const result = parseTokens([TOKEN, { id: 'bad' }, 7, { ...TOKEN, id: 't2' }])
    expect(result).toEqual([TOKEN, { ...TOKEN, id: 't2' }])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd app
npm test -- battle-maps/tokenModel.test.ts
```

Expected: FAIL with "Cannot find module './tokenModel'".

- [ ] **Step 3: Implement `tokenModel.ts`**

Create `app/src/battle-maps/tokenModel.ts`:

```typescript
import { MAP_SIZE_CELLS } from '../battle-map/domain/grid'
import type { TokenRenderState } from '../battle-map/domain/tokens'

export type Token = {
  id: string
  battle_map_id: string
  label: string
  color: string
  column: number
  row: number
  elevation: number
}

export function isTokenCellOnMap(column: number, row: number): boolean {
  return (
    Number.isInteger(column) &&
    Number.isInteger(row) &&
    column >= 0 &&
    row >= 0 &&
    column < MAP_SIZE_CELLS &&
    row < MAP_SIZE_CELLS
  )
}

export function tokenToRenderState(token: Token): TokenRenderState {
  return {
    id: token.id,
    label: token.label,
    cell: { column: token.column, row: token.row },
    elevation: token.elevation,
    color: token.color,
    visible: true,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isToken(value: unknown): value is Token {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.battle_map_id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.color === 'string' &&
    typeof value.elevation === 'number' &&
    typeof value.column === 'number' &&
    typeof value.row === 'number' &&
    isTokenCellOnMap(value.column, value.row)
  )
}

export function parseTokens(value: unknown): Token[] {
  if (!Array.isArray(value)) return []
  return value.filter(isToken)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- battle-maps/tokenModel.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: prior count + 6, zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/battle-maps/tokenModel.ts src/battle-maps/tokenModel.test.ts
git commit -m "Add token persistence model, validation, and render-state mapping"
```

---

### Task 2: `tokens` table and DM-only RPCs

**Files:**
- Create: `app/supabase/migrations/0005_battle_map_tokens.sql`
- Create: `app/tests/integration/battle-map-tokens.rpc.test.ts`

**Interfaces:**
- Consumes: `public.battle_maps`, `public.campaigns`, `public.is_campaign_member` (from earlier migrations)
- Produces: table `public.tokens` (`id uuid`, `battle_map_id uuid`, `label text`, `color text`, `column int`, `row int`, `elevation real`, `created_by uuid`, `created_at timestamptz`); RPCs `create_token(p_map_id uuid, p_label text, p_color text, p_column int, p_row int) returns public.tokens`, `move_token(p_token_id uuid, p_column int, p_row int) returns public.tokens`, `delete_token(p_token_id uuid) returns void` — all DM-only. Task 3's `api.ts` calls these by exact name/params.

**Prerequisite:** Docker running + `npx supabase start`.

- [ ] **Step 1: Write the migration**

Create `app/supabase/migrations/0005_battle_map_tokens.sql`:

```sql
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
```

- [ ] **Step 2: Apply the migration locally**

```bash
cd app
npx supabase status   # confirm the stack is up; npx supabase start if not
npx supabase db reset
```

Expected: "Finished supabase db reset" with no SQL errors (re-applies 0001–0005).

- [ ] **Step 3: Write the integration test**

Create `app/tests/integration/battle-map-tokens.rpc.test.ts` — same two-user pattern as `battle-map-terrain.rpc.test.ts` (same `createTestUserClient` helper, same env var contract, same cascade-safe `afterAll` deleting the DM's campaigns first):

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

type Row = { id: string; [key: string]: unknown }
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

describe('token RPCs', () => {
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

  async function dmMap(name: string): Promise<string> {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: name })
      .single()) as RpcSingleResult<Row>
    const { data: map } = (await dm.client
      .rpc('create_battle_map', { p_campaign_id: campaign!.id, p_name: `${name} map` })
      .single()) as RpcSingleResult<Row>
    return map!.id
  }

  it('lets the DM create, move, read, and delete a token', async () => {
    const mapId = await dmMap('Tokens A')

    const { data: token, error: createError } = (await dm.client
      .rpc('create_token', {
        p_map_id: mapId,
        p_label: 'Goblin',
        p_color: '#4f9e63',
        p_column: 100,
        p_row: 100,
      })
      .single()) as RpcSingleResult<Row>
    expect(createError).toBeNull()
    expect(token?.label).toBe('Goblin')

    const { data: moved, error: moveError } = (await dm.client
      .rpc('move_token', { p_token_id: token!.id, p_column: 105, p_row: 108 })
      .single()) as RpcSingleResult<Row>
    expect(moveError).toBeNull()
    expect(moved?.column).toBe(105)
    expect(moved?.row).toBe(108)

    const { data: rows } = await dm.client.from('tokens').select('*').eq('battle_map_id', mapId)
    expect(rows).toHaveLength(1)

    const { error: deleteError } = await dm.client.rpc('delete_token', { p_token_id: token!.id })
    expect(deleteError).toBeNull()

    const { data: afterDelete } = await dm.client.from('tokens').select('*').eq('battle_map_id', mapId)
    expect(afterDelete).toHaveLength(0)
  })

  it('rejects a non-DM member creating or moving a token', async () => {
    const mapId = await dmMap('Tokens B')
    const { data: campaignRow } = await dm.client
      .from('battle_maps')
      .select('campaign_id')
      .eq('id', mapId)
      .single()
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: (campaignRow as Row).campaign_id })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', {
      p_code: (invitation as { code: string }).code,
    })

    const { error: createError } = await player.client.rpc('create_token', {
      p_map_id: mapId,
      p_label: 'Intruder',
      p_color: '#ff0000',
      p_column: 50,
      p_row: 50,
    })
    expect(createError).not.toBeNull()

    // DM makes a token, player tries to move it → rejected.
    const { data: token } = (await dm.client
      .rpc('create_token', {
        p_map_id: mapId,
        p_label: 'Guard',
        p_color: '#4f7fbf',
        p_column: 10,
        p_row: 10,
      })
      .single()) as RpcSingleResult<Row>
    const { error: moveError } = await player.client.rpc('move_token', {
      p_token_id: token!.id,
      p_column: 11,
      p_row: 11,
    })
    expect(moveError).not.toBeNull()
  })

  it('lets a fellow campaign member read tokens (RLS), even if not DM', async () => {
    const mapId = await dmMap('Tokens C')
    const { data: campaignRow } = await dm.client
      .from('battle_maps')
      .select('campaign_id')
      .eq('id', mapId)
      .single()
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: (campaignRow as Row).campaign_id })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', {
      p_code: (invitation as { code: string }).code,
    })
    await dm.client.rpc('create_token', {
      p_map_id: mapId,
      p_label: 'Visible',
      p_color: '#d1a94f',
      p_column: 20,
      p_row: 20,
    })

    const { data: rows, error } = await player.client
      .from('tokens')
      .select('*')
      .eq('battle_map_id', mapId)
    expect(error).toBeNull()
    expect(rows).toHaveLength(1)
  })
})
```

- [ ] **Step 4: Run the integration test**

```bash
npx supabase status   # copy ANON_KEY / SERVICE_ROLE_KEY
SUPABASE_SERVICE_ROLE_KEY=<key> SUPABASE_ANON_KEY=<key> npm run test:db
```

Expected: PASS — 13 tests (10 existing + 3 new token tests).

- [ ] **Step 5: Run the unit suite and build**

```bash
npm test
npm run build
```

Expected: unchanged from Task 1 (no `src/` change here), zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0005_battle_map_tokens.sql tests/integration/battle-map-tokens.rpc.test.ts
git commit -m "Add tokens table, RLS, and DM-only create/move/delete RPCs"
```

---

### Task 3: API layer — token CRUD

**Files:**
- Modify: `app/src/battle-maps/api.ts`
- Modify: `app/src/battle-maps/api.test.ts`

**Interfaces:**
- Consumes: `Token`, `parseTokens` from `./tokenModel` (Task 1); `supabase` from `../lib/supabaseClient`
- Produces (all in `api.ts`): `listBattleMapTokens(mapId: string): Promise<Token[]>` (reads `tokens` table, `parseTokens` on the way out), `createToken(mapId: string, label: string, color: string, column: number, row: number): Promise<Token>`, `moveToken(tokenId: string, column: number, row: number): Promise<Token>`, `deleteToken(tokenId: string): Promise<void>`. Tasks 4/5 import these. A single-row parse helper `toToken(raw): Token` mirrors `toBattleMap`.

- [ ] **Step 1: Write the failing tests**

Add to `app/src/battle-maps/api.test.ts` a new describe block (the file already mocks `../lib/supabaseClient`). Add `Token`-shaped fixtures and coverage. Add these imports to the existing import from `./api`:

```typescript
import {
  createToken,
  deleteToken,
  listBattleMapTokens,
  moveToken,
  // ...existing imports (createBattleMap, getBattleMap, listCampaignBattleMaps, setBattleMapTerrain)
} from './api'
```

Add:

```typescript
const FIXTURE_TOKEN = {
  id: 't1',
  battle_map_id: 'map-1',
  label: 'Goblin',
  color: '#4f9e63',
  column: 100,
  row: 100,
  elevation: 0,
}

describe('listBattleMapTokens', () => {
  it('selects tokens for the map and parses them', async () => {
    const eq = vi.fn().mockResolvedValue({ data: [FIXTURE_TOKEN], error: null })
    const select = vi.fn().mockReturnValue({ eq })
    vi.mocked(supabase.from).mockReturnValue({ select } as never)

    const result = await listBattleMapTokens('map-1')

    expect(supabase.from).toHaveBeenCalledWith('tokens')
    expect(eq).toHaveBeenCalledWith('battle_map_id', 'map-1')
    expect(result).toEqual([FIXTURE_TOKEN])
  })
})

describe('createToken', () => {
  it('calls the create_token RPC with the placement args', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: FIXTURE_TOKEN, error: null } as never)

    const result = await createToken('map-1', 'Goblin', '#4f9e63', 100, 100)

    expect(supabase.rpc).toHaveBeenCalledWith('create_token', {
      p_map_id: 'map-1',
      p_label: 'Goblin',
      p_color: '#4f9e63',
      p_column: 100,
      p_row: 100,
    })
    expect(result).toEqual(FIXTURE_TOKEN)
  })
})

describe('moveToken', () => {
  it('calls the move_token RPC and returns the moved token', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { ...FIXTURE_TOKEN, column: 105, row: 108 },
      error: null,
    } as never)

    const result = await moveToken('t1', 105, 108)

    expect(supabase.rpc).toHaveBeenCalledWith('move_token', {
      p_token_id: 't1',
      p_column: 105,
      p_row: 108,
    })
    expect(result.column).toBe(105)
  })

  it('throws when the move RPC errors', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Only the current DM can move tokens on this battle map' },
    } as never)

    await expect(moveToken('t1', 1, 1)).rejects.toThrow('Only the current DM can move tokens')
  })
})

describe('deleteToken', () => {
  it('calls the delete_token RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never)

    await deleteToken('t1')

    expect(supabase.rpc).toHaveBeenCalledWith('delete_token', { p_token_id: 't1' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- battle-maps/api.test.ts
```

Expected: FAIL — the four token functions aren't exported.

- [ ] **Step 3: Add the token functions to `api.ts`**

Append to `app/src/battle-maps/api.ts` (keep all existing exports untouched; add the import and the four functions):

```typescript
import { parseTokens, type Token } from './tokenModel'
```

```typescript
function toToken(raw: unknown): Token {
  const [parsed] = parseTokens([raw])
  if (!parsed) throw new Error('Received a malformed token row from the server')
  return parsed
}

export async function listBattleMapTokens(mapId: string): Promise<Token[]> {
  const { data, error } = await supabase.from('tokens').select('*').eq('battle_map_id', mapId)
  if (error) throw new Error(error.message)
  return parseTokens(data)
}

export async function createToken(
  mapId: string,
  label: string,
  color: string,
  column: number,
  row: number,
): Promise<Token> {
  const { data, error } = await supabase.rpc('create_token', {
    p_map_id: mapId,
    p_label: label,
    p_color: color,
    p_column: column,
    p_row: row,
  })
  if (error) throw new Error(error.message)
  return toToken(data)
}

export async function moveToken(tokenId: string, column: number, row: number): Promise<Token> {
  const { data, error } = await supabase.rpc('move_token', {
    p_token_id: tokenId,
    p_column: column,
    p_row: row,
  })
  if (error) throw new Error(error.message)
  return toToken(data)
}

export async function deleteToken(tokenId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_token', { p_token_id: tokenId })
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- battle-maps/api.test.ts
```

Expected: PASS (existing tests plus the 5 new token ones).

- [ ] **Step 5: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: all green, zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/battle-maps/api.ts src/battle-maps/api.test.ts
git commit -m "Add token CRUD to the Battle Map API layer"
```

---

### Task 4: Render + persist tokens on the Battle Map page

**Files:**
- Modify: `app/src/battle-map/BattleMapView.tsx`
- Modify: `app/src/battle-map/BattleMapView.test.tsx`
- Modify: `app/src/battle-maps/BattleMapPage.tsx`
- Modify: `app/src/battle-maps/BattleMapPage.test.tsx`

**Interfaces:**
- Consumes: `Token`, `tokenToRenderState` from `../battle-maps/tokenModel`; `listBattleMapTokens`, `moveToken` from `./api` (Task 3); the renderer's existing `MoveIntent` type and `BattleMapScene` `tokens`/`onMoveIntent` props
- Produces: `BattleMapView` gains `tokens?: readonly TokenRenderState[]` and `onMoveIntent?: (intent: MoveIntent) => void` props, forwarded to `BattleMapScene`. `BattleMapPage` fetches tokens, holds them in state, renders them, and persists a drag-move via `moveToken`. Task 5 adds the palette panel that mutates the same token state.

- [ ] **Step 1: Thread token props through `BattleMapView`**

Modify `app/src/battle-map/BattleMapView.tsx`. Add the renderer type imports and two props, forward to the scene. New full file:

```typescript
import { MapControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useRef } from 'react'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import type { TerrainFeature } from '../battle-maps/terrain'
import type { MoveIntent, TokenRenderState } from './domain/tokens'
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
  tokens?: readonly TokenRenderState[]
  onMoveIntent?: (intent: MoveIntent) => void
}

export function BattleMapView({ terrain = [], tokens = [], onMoveIntent }: BattleMapViewProps = {}) {
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
        <BattleMapScene terrainFeatures={terrain} tokens={tokens} onMoveIntent={onMoveIntent} />
      </Canvas>
    </div>
  )
}
```

Note: the import path for the renderer types is `./domain/tokens` (relative to `battle-map/`), NOT `../battle-maps/tokenModel` — `BattleMapView` deals in the renderer's `TokenRenderState`/`MoveIntent`, and the mapping from the persisted `Token` happens up in `BattleMapPage`. `BattleMapScene`'s `onMoveIntent` prop is optional and already defaults to a no-op, so passing `undefined` is safe.

- [ ] **Step 2: Update `BattleMapView.test.tsx` composition assertion**

The composition test asserts `<BattleMapScene />`'s props. It will now also carry `tokens` and `onMoveIntent`. Read the existing third test; update the `sceneElement.props` expectation to include `tokens: []` and `onMoveIntent: undefined` (matching the defaults when `BattleMapView()` is called with no args), or, if it only checks `sceneElement.type === BattleMapScene`, leave it. Run:

```bash
npm test -- BattleMapView.test.tsx
```

Expected: PASS (adjust the one assertion if the run shows a props mismatch).

- [ ] **Step 3: Write the failing test for `BattleMapPage` token behavior**

The `BattleMapPage.test.tsx` file mocks `../battle-map/BattleMapView`, `./api`, and `./TerrainEditorPanel`. Add `listBattleMapTokens`/`moveToken` to the `./api` mock and a test that the page fetches tokens and passes them to the view. Because `BattleMapView` is mocked, capture its received props. Update the `./api` mock:

```typescript
vi.mock('./api', () => ({
  getBattleMap: vi.fn(),
  listBattleMapTokens: vi.fn(),
  moveToken: vi.fn(),
  // keep any others the page's module graph imports (e.g. setBattleMapTerrain via TerrainEditorPanel is mocked separately)
}))
```

Make the `BattleMapView` mock capture props:

```typescript
const battleMapViewProps = vi.fn()
vi.mock('../battle-map/BattleMapView', () => ({
  BattleMapView: (props: unknown) => {
    battleMapViewProps(props)
    return <div data-testid="battle-map-view" />
  },
}))
```

Add a test:

```typescript
it('loads the map tokens and passes them to the battle map view', async () => {
  vi.mocked(getBattleMap).mockResolvedValue({
    id: 'map-1',
    campaign_id: 'c1',
    name: 'Map A',
    created_by: 'u1',
    created_at: 'now',
    terrain: [],
  })
  vi.mocked(listBattleMapTokens).mockResolvedValue([
    {
      id: 't1',
      battle_map_id: 'map-1',
      label: 'Goblin',
      color: '#4f9e63',
      column: 100,
      row: 100,
      elevation: 0,
    },
  ])

  renderAt('map-1') // however the existing tests render the page/route

  await screen.findByTestId('battle-map-view')
  await waitFor(() => {
    const lastCall = battleMapViewProps.mock.calls.at(-1)?.[0] as { tokens: unknown[] }
    expect(lastCall.tokens).toHaveLength(1)
  })
})
```

Adapt `renderAt`/imports to the file's existing helpers. Import `getBattleMap`, `listBattleMapTokens` from `./api` in the test.

- [ ] **Step 4: Run it to verify it fails**

```bash
npm test -- BattleMapPage.test.tsx
```

Expected: FAIL — the page doesn't fetch tokens or pass them to the view yet.

- [ ] **Step 5: Wire tokens into `BattleMapPage`**

Modify `app/src/battle-maps/BattleMapPage.tsx` to fetch tokens alongside the map, hold them in state, map them to render-state for the view, and persist drag-moves. Full new file:

```typescript
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { BattleMapView } from '../battle-map/BattleMapView'
import type { MoveIntent } from '../battle-map/domain/tokens'
import { type BattleMap, getBattleMap, listBattleMapTokens, moveToken } from './api'
import type { TerrainFeature } from './terrain'
import { TerrainEditorPanel } from './TerrainEditorPanel'
import { type Token, tokenToRenderState } from './tokenModel'

export function BattleMapPage() {
  const { mapId } = useParams()
  const [map, setMap] = useState<BattleMap | null>(null)
  const [terrain, setTerrain] = useState<TerrainFeature[]>([])
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapId) return
    setLoading(true)
    setError(null)
    Promise.all([getBattleMap(mapId), listBattleMapTokens(mapId)])
      .then(([mapResult, tokenResult]) => {
        setMap(mapResult)
        setTerrain(mapResult?.terrain ?? [])
        setTokens(tokenResult)
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : String(loadError))
        setLoading(false)
      })
  }, [mapId])

  const handleMoveIntent = useCallback((intent: MoveIntent) => {
    setTokens((current) =>
      current.map((token) =>
        token.id === intent.tokenId
          ? { ...token, column: intent.to.column, row: intent.to.row }
          : token,
      ),
    )
    moveToken(intent.tokenId, intent.to.column, intent.to.row)
      .then((saved) =>
        setTokens((current) => current.map((token) => (token.id === saved.id ? saved : token))),
      )
      .catch((moveError: unknown) =>
        setError(moveError instanceof Error ? moveError.message : String(moveError)),
      )
  }, [])

  if (loading) return <div>Loading map...</div>
  if (error) return <div className="error-message">Failed to load battle map: {error}</div>
  if (!map) return <div>Battle map not found.</div>

  return (
    <main className="battle-map-page">
      <h1>{map.name}</h1>
      <BattleMapView
        terrain={terrain}
        tokens={tokens.map(tokenToRenderState)}
        onMoveIntent={handleMoveIntent}
      />
      <TerrainEditorPanel map={map} onTerrainChange={setTerrain} />
    </main>
  )
}
```

Notes: the load now `Promise.all`s the map and its tokens (one combined `.catch` preserves the established load-error pattern). `handleMoveIntent` optimistically moves the token locally, persists via `moveToken`, then reconciles from the server's returned row (the same "adopt the server's normalized value" pattern the terrain final review established); on failure it surfaces an error. Task 5 will add the palette panel and thread `setTokens` to it.

- [ ] **Step 6: Run the page test to verify it passes**

```bash
npm test -- BattleMapPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: all green, zero TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/battle-map/BattleMapView.tsx src/battle-map/BattleMapView.test.tsx src/battle-maps/BattleMapPage.tsx src/battle-maps/BattleMapPage.test.tsx
git commit -m "Render map tokens and persist drag-moves on the Battle Map page"
```

---

### Task 5: Token palette panel (DM add/remove)

**Files:**
- Create: `app/src/battle-maps/TokenPalettePanel.tsx`
- Create: `app/src/battle-maps/TokenPalettePanel.test.tsx`
- Modify: `app/src/battle-maps/BattleMapPage.tsx`
- Modify: `app/src/battle-maps/BattleMapPage.test.tsx`

**Interfaces:**
- Consumes: `Token` from `./tokenModel`; `createToken`, `deleteToken` from `./api` (Task 3)
- Produces: `<TokenPalettePanel mapId={string} tokens={Token[]} onTokensChange={(tokens) => void} />` — lists tokens with a Remove control and an add-form (label + color); create places the token at map center (column 100, row 100) and reports the new list up; the DM drags it into place afterward (drag-move from Task 4 persists it). Last task.

- [ ] **Step 1: Write the failing test**

Create `app/src/battle-maps/TokenPalettePanel.test.tsx`:

```typescript
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Token } from './tokenModel'

afterEach(() => cleanup())

vi.mock('./api', () => ({
  createToken: vi.fn(),
  deleteToken: vi.fn(),
}))

import { createToken, deleteToken } from './api'
import { TokenPalettePanel } from './TokenPalettePanel'

const GOBLIN: Token = {
  id: 't1',
  battle_map_id: 'map-1',
  label: 'Goblin',
  color: '#4f9e63',
  column: 100,
  row: 100,
  elevation: 0,
}

describe('TokenPalettePanel', () => {
  it('lists tokens with a remove control', () => {
    render(<TokenPalettePanel mapId="map-1" tokens={[GOBLIN]} onTokensChange={vi.fn()} />)
    expect(screen.getByText(/goblin/i, { selector: 'li' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
  })

  it('adds a token, persists via createToken, and reports the new list up', async () => {
    vi.mocked(createToken).mockResolvedValue(GOBLIN)
    const onTokensChange = vi.fn()
    render(<TokenPalettePanel mapId="map-1" tokens={[]} onTokensChange={onTokensChange} />)

    fireEvent.change(screen.getByLabelText(/label/i), { target: { value: 'Goblin' } })
    fireEvent.click(screen.getByRole('button', { name: /add token/i }))

    await waitFor(() =>
      expect(createToken).toHaveBeenCalledWith('map-1', 'Goblin', expect.any(String), 100, 100),
    )
    expect(onTokensChange).toHaveBeenCalledWith([GOBLIN])
  })

  it('removes a token via deleteToken and reports the new list up', async () => {
    vi.mocked(deleteToken).mockResolvedValue(undefined)
    const onTokensChange = vi.fn()
    render(<TokenPalettePanel mapId="map-1" tokens={[GOBLIN]} onTokensChange={onTokensChange} />)

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    await waitFor(() => expect(deleteToken).toHaveBeenCalledWith('t1'))
    expect(onTokensChange).toHaveBeenCalledWith([])
  })

  it('shows an error when adding fails', async () => {
    vi.mocked(createToken).mockRejectedValueOnce(
      new Error('Only the current DM can add tokens to this battle map'),
    )
    render(<TokenPalettePanel mapId="map-1" tokens={[]} onTokensChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/label/i), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: /add token/i }))

    expect(await screen.findByText(/only the current dm can add tokens/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npm test -- TokenPalettePanel.test.tsx
```

Expected: FAIL with "Cannot find module './TokenPalettePanel'".

- [ ] **Step 3: Implement `TokenPalettePanel`**

Create `app/src/battle-maps/TokenPalettePanel.tsx`:

```typescript
import { useState } from 'react'
import { createToken, deleteToken } from './api'
import type { Token } from './tokenModel'

type TokenPalettePanelProps = {
  mapId: string
  tokens: Token[]
  onTokensChange: (tokens: Token[]) => void
}

const DEFAULT_CELL = { column: 100, row: 100 }
const DEFAULT_COLOR = '#4f7fbf'

export function TokenPalettePanel({ mapId, tokens, onTokensChange }: TokenPalettePanelProps) {
  const [label, setLabel] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const created = await createToken(mapId, label, color, DEFAULT_CELL.column, DEFAULT_CELL.row)
      onTokensChange([...tokens, created])
      setLabel('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleRemove(id: string) {
    setError(null)
    try {
      await deleteToken(id)
      onTokensChange(tokens.filter((token) => token.id !== id))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="token-palette-panel">
      <h2>Tokens</h2>
      <ul>
        {tokens.map((token) => (
          <li key={token.id}>
            {token.label} at ({token.column}, {token.row})
            <button type="button" onClick={() => void handleRemove(token.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd}>
        <label htmlFor="token-label">Label</label>
        <input id="token-label" value={label} onChange={(event) => setLabel(event.target.value)} required />
        <label htmlFor="token-color">Color</label>
        <input
          id="token-color"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
        <button type="submit">Add token</button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </section>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- TokenPalettePanel.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Render the palette from `BattleMapPage`**

Modify `app/src/battle-maps/BattleMapPage.tsx` — import the panel and render it, passing the token state and `setTokens`. Add the import:

```typescript
import { TokenPalettePanel } from './TokenPalettePanel'
```

And add the panel to the returned JSX, after `TerrainEditorPanel`:

```typescript
      <TerrainEditorPanel map={map} onTerrainChange={setTerrain} />
      <TokenPalettePanel mapId={map.id} tokens={tokens} onTokensChange={setTokens} />
```

Because `setTokens` updates the same state the view renders from (`tokens.map(tokenToRenderState)`), adding or removing a token re-renders the scene live, exactly like the drag-move path.

- [ ] **Step 6: Update `BattleMapPage.test.tsx`**

The page now imports `TokenPalettePanel`, which imports `createToken`/`deleteToken` from `./api` — so the `./api` mock must export those too (add `createToken: vi.fn(), deleteToken: vi.fn()`). Mock `./TokenPalettePanel` to keep the page test focused (same as `TerrainEditorPanel` is mocked):

```typescript
vi.mock('./TokenPalettePanel', () => ({
  TokenPalettePanel: () => <div data-testid="token-palette-panel" />,
}))
```

Add an assertion to the success-path test that `token-palette-panel` mounts.

- [ ] **Step 7: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: all green, zero TypeScript errors.

- [ ] **Step 8: Verify the full DB round-trip against the local stack**

```bash
npx supabase status
SUPABASE_SERVICE_ROLE_KEY=<key> SUPABASE_ANON_KEY=<key> npm run test:db
```

Expected: PASS, 13 tests (the token integration tests from Task 2 still green — confirms the DB layer the UI drives is intact).

- [ ] **Step 9: Commit**

```bash
git add src/battle-maps/TokenPalettePanel.tsx src/battle-maps/TokenPalettePanel.test.tsx src/battle-maps/BattleMapPage.tsx src/battle-maps/BattleMapPage.test.tsx
git commit -m "Add token palette panel to the Battle Map page"
```

---

## Post-plan state

After Task 5, a DM opens a Battle Map, adds named/colored tokens (placed at map center), drags them into position in the 2.5D scene, and removes them — each token and every move persisted on the `tokens` table and restored on reload. Still deferred, each its own future plan: per-player token ownership (a player moving the token linked to their Character — needs the Characters subsystem), realtime multi-viewer sync so others see a move live (issue #9's Supabase Realtime work), per-viewer fog-of-war visibility (tokens currently render `visible: true` for everyone), token HP/status/stat blocks (needs Rules Objects, issue #7), and auto-elevation of tokens standing on raised terrain. The orphaned Playwright e2e suite remains a separate cleanup, untouched here.
