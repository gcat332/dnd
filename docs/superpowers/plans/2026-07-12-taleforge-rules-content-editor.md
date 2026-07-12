# Taleforge Rules Content Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a DM author campaign-scoped rules-bearing content — starting with **abilities** — through a Content Editor: create an ability with structured mechanical fields (action cost, resource cost, targeting, range, damage dice) plus freeform name/description, list them, edit them, and remove them, all persisted per-campaign. This is the tracer-bullet slice of the Rules Content Editor (GitHub #7): one content type done end-to-end through the shared Procedural Ability Template shape, with the remaining types (spell/monster/item/encounter/trait/resource) deferred to follow-up plans that reuse the same table and pattern.

**Architecture:** A `rules_objects` table (campaign-scoped, per Wayfinder issue #4), gated the way `battle_maps`/tokens/terrain are — RLS for member reads, DM-only `SECURITY DEFINER` RPCs for create/update/delete. A pure TypeScript module owns the `RulesObject` shape, the `AbilityMechanics` structured schema (the Procedural Ability Template MVP), and its balance-constraint validation. A Content Editor panel on the Campaign Dashboard drives the RPCs. Everything lives in a NEW `app/src/rules-content/` module — no shared files with the battle-map renderer or the token/terrain work.

**Tech Stack:** Same as the rest of the app (Vite, React 19, TypeScript, Vitest, `@supabase/supabase-js`, `react-router`). No 3D/renderer involvement. No new dependencies.

## Global Constraints

- **Coordination:** Another agent (Codex) is concurrently implementing the controlled-orbit camera and a character slice, working entirely in `app/src/battle-map/**` (camera/scene/DimensionalTerrain/useBattleMapView/BattleMapView), `app/src/battle-map/characters/**`, `public/assets/**`, and asset scripts. This plan must NOT touch any of those. It touches only: a new migration, a new `app/src/rules-content/**` module, and `app/src/campaigns/CampaignDashboardPage.tsx` (adding one panel). Do not edit `app/src/battle-maps/api.ts` either — rules objects are campaign-scoped, not battle-map-scoped, and get their own `rules-content/api.ts`.
- Rules Objects are Campaign-scoped via a `campaign_id` FK (issue #4). No battle-map or session link.
- Content edits are DM-only writes via `SECURITY DEFINER` RPCs gated by the campaign's `dm_user_id = auth.uid()` — the same gateway pattern as `create_battle_map`/`set_battle_map_terrain`/`create_token`. Reads use an RLS SELECT policy reusing `is_campaign_member`.
- **This slice ships the `ability` type only.** The `rules_objects.type` column is a text enum covering all seven editable types (`ability`, `spell`, `monster`, `item`, `encounter`, `trait`, `resource`) so future plans add the others without a schema change, but the editor form and validation in THIS plan handle `ability` only. `damage_type` and `condition` are NOT in the enum — they stay developer-fixed system taxonomy (ticket #7 decision).
- Every DM-authored object is stored with `source = 'homebrew'` (the `source` enum also allows `starter`/`ai-generated` for future use, per issue #4). No AI generation here (that's #8).
- **Hybrid schema (ticket #7):** the mechanically-relevant fields (`AbilityMechanics`: action cost, resource cost, targeting, range, damage dice) are structured and validated with balance-constraint bounds checking; `name`/`description` are freeform. There is NO object-version-history UI (ticket #7): editing overwrites the live object; the "history snapshot" mechanism lives in Session Log, which doesn't exist yet, so it's simply out of scope here.
- Migrations are append-only: this plan adds `0006_rules_objects.sql`; it must never edit `0001`–`0005`. Include inline `GRANT`s (SELECT on the table, EXECUTE on each RPC) to `authenticated` (hosted Supabase revokes Data API privileges by default — established in `0002`, reapplied in `0003`/`0004`/`0005`).
- New integration test files keep `fileParallelism: false` (already set in `vitest.integration.config.ts`).
- No placeholder/mock **data** ships — every UI reads/writes the real Supabase project; mocking `../lib/supabaseClient` inside a unit test is expected TDD isolation.
- Docker + local Supabase are needed for Task 2 and Task 5's `test:db` verification (`npx supabase start`). Tasks 1, 3, 4 are pure TS/React.

---

## File Structure

```
app/
  supabase/migrations/
    0006_rules_objects.sql             # rules_objects table, RLS, CRUD RPCs, grants (Task 2)
  tests/integration/
    rules-objects.rpc.test.ts           # real Postgres integration test (Task 2)
  src/
    rules-content/
      rulesObject.ts                    # RulesObject + AbilityMechanics model, validation (Task 1)
      rulesObject.test.ts
      api.ts                            # list/create/update/delete rules objects (Task 3)
      api.test.ts
      AbilityForm.tsx                    # the structured ability create/edit form (Task 4, reused Task 5)
      RulesContentEditorPanel.tsx        # list + create + remove (Task 4), + edit (Task 5)
      RulesContentEditorPanel.test.tsx
    campaigns/
      CampaignDashboardPage.tsx          # modified: render <RulesContentEditorPanel> (Task 4)
```

---

### Task 1: Rules Object model, ability mechanics schema, and validation

**Files:**
- Create: `app/src/rules-content/rulesObject.ts`
- Create: `app/src/rules-content/rulesObject.test.ts`

**Interfaces:**
- Consumes: nothing (pure module)
- Produces: enums `RULES_OBJECT_TYPES` (7 editable types) and `RULES_OBJECT_SOURCES`; types `RulesObjectType`, `RulesObjectSource`, `AbilityMechanics` (`{ actionCost: ActionCost; resourceCost: number; targeting: Targeting; range: number; damageDice: string }`), `RulesObject` (`{ id; campaign_id; type; source; name; description; mechanics }`); `ACTION_COSTS`, `TARGETINGS` enums; `isValidAbilityMechanics(value): value is AbilityMechanics`; `emptyAbilityMechanics(): AbilityMechanics`; `parseRulesObjects(value): RulesObject[]`. Tasks 3/4/5 import these.

- [ ] **Step 1: Write the failing tests**

Create `app/src/rules-content/rulesObject.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  emptyAbilityMechanics,
  isValidAbilityMechanics,
  parseRulesObjects,
  type AbilityMechanics,
  type RulesObject,
} from './rulesObject'

const MECHANICS: AbilityMechanics = {
  actionCost: 'action',
  resourceCost: 1,
  targeting: 'single',
  range: 6,
  damageDice: '2d6',
}

const ABILITY: RulesObject = {
  id: 'r1',
  campaign_id: 'c1',
  type: 'ability',
  source: 'homebrew',
  name: 'Firebolt',
  description: 'A dart of flame.',
  mechanics: MECHANICS,
}

describe('isValidAbilityMechanics', () => {
  it('accepts well-formed mechanics', () => {
    expect(isValidAbilityMechanics(MECHANICS)).toBe(true)
  })

  it('accepts an empty damage-dice string (non-damaging ability)', () => {
    expect(isValidAbilityMechanics({ ...MECHANICS, damageDice: '' })).toBe(true)
  })

  it('rejects an unknown action cost or targeting', () => {
    expect(isValidAbilityMechanics({ ...MECHANICS, actionCost: 'teleport' })).toBe(false)
    expect(isValidAbilityMechanics({ ...MECHANICS, targeting: 'everywhere' })).toBe(false)
  })

  it('rejects negative or non-integer resourceCost / range (balance bounds)', () => {
    expect(isValidAbilityMechanics({ ...MECHANICS, resourceCost: -1 })).toBe(false)
    expect(isValidAbilityMechanics({ ...MECHANICS, range: 1.5 })).toBe(false)
  })

  it('rejects resourceCost or range above the balance cap', () => {
    expect(isValidAbilityMechanics({ ...MECHANICS, resourceCost: 21 })).toBe(false)
    expect(isValidAbilityMechanics({ ...MECHANICS, range: 201 })).toBe(false)
  })

  it('rejects a malformed damage-dice string', () => {
    expect(isValidAbilityMechanics({ ...MECHANICS, damageDice: 'banana' })).toBe(false)
    expect(isValidAbilityMechanics({ ...MECHANICS, damageDice: '2d' })).toBe(false)
  })

  it('accepts valid dice notation with an optional modifier', () => {
    expect(isValidAbilityMechanics({ ...MECHANICS, damageDice: '1d20' })).toBe(true)
    expect(isValidAbilityMechanics({ ...MECHANICS, damageDice: '3d8+4' })).toBe(true)
  })
})

describe('emptyAbilityMechanics', () => {
  it('returns a valid default', () => {
    expect(isValidAbilityMechanics(emptyAbilityMechanics())).toBe(true)
  })
})

describe('parseRulesObjects', () => {
  it('returns [] for non-array input', () => {
    expect(parseRulesObjects(null)).toEqual([])
    expect(parseRulesObjects({})).toEqual([])
  })

  it('keeps well-formed rows and drops malformed ones', () => {
    const result = parseRulesObjects([ABILITY, { id: 'bad' }, 7, { ...ABILITY, id: 'r2' }])
    expect(result).toEqual([ABILITY, { ...ABILITY, id: 'r2' }])
  })

  it('drops a row whose mechanics fail validation', () => {
    const result = parseRulesObjects([{ ...ABILITY, mechanics: { ...MECHANICS, range: -5 } }])
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd app
npm test -- rules-content/rulesObject.test.ts
```

Expected: FAIL with "Cannot find module './rulesObject'".

- [ ] **Step 3: Implement `rulesObject.ts`**

Create `app/src/rules-content/rulesObject.ts`:

```typescript
export const RULES_OBJECT_TYPES = [
  'ability',
  'spell',
  'monster',
  'item',
  'encounter',
  'trait',
  'resource',
] as const
export type RulesObjectType = (typeof RULES_OBJECT_TYPES)[number]

export const RULES_OBJECT_SOURCES = ['starter', 'homebrew', 'ai-generated'] as const
export type RulesObjectSource = (typeof RULES_OBJECT_SOURCES)[number]

export const ACTION_COSTS = ['action', 'bonus', 'reaction', 'free'] as const
export type ActionCost = (typeof ACTION_COSTS)[number]

export const TARGETINGS = ['self', 'single', 'area'] as const
export type Targeting = (typeof TARGETINGS)[number]

export type AbilityMechanics = {
  actionCost: ActionCost
  resourceCost: number
  targeting: Targeting
  range: number
  damageDice: string
}

export type RulesObject = {
  id: string
  campaign_id: string
  type: RulesObjectType
  source: RulesObjectSource
  name: string
  description: string
  mechanics: AbilityMechanics
}

// Balance-constraint caps (ticket #7 "balance-constraint bounds checking").
const MAX_RESOURCE_COST = 20
const MAX_RANGE_CELLS = 200
// e.g. "2d6", "1d20", "3d8+4" — count d sides, optional +modifier.
const DICE_PATTERN = /^\d+d\d+(\+\d+)?$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

export function isValidAbilityMechanics(value: unknown): value is AbilityMechanics {
  if (!isRecord(value)) return false
  if (!ACTION_COSTS.includes(value.actionCost as ActionCost)) return false
  if (!TARGETINGS.includes(value.targeting as Targeting)) return false
  if (!isIntInRange(value.resourceCost, 0, MAX_RESOURCE_COST)) return false
  if (!isIntInRange(value.range, 0, MAX_RANGE_CELLS)) return false
  if (typeof value.damageDice !== 'string') return false
  if (value.damageDice !== '' && !DICE_PATTERN.test(value.damageDice)) return false
  return true
}

export function emptyAbilityMechanics(): AbilityMechanics {
  return { actionCost: 'action', resourceCost: 0, targeting: 'single', range: 1, damageDice: '' }
}

function isRulesObject(value: unknown): value is RulesObject {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.campaign_id === 'string' &&
    RULES_OBJECT_TYPES.includes(value.type as RulesObjectType) &&
    RULES_OBJECT_SOURCES.includes(value.source as RulesObjectSource) &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    isValidAbilityMechanics(value.mechanics)
  )
}

export function parseRulesObjects(value: unknown): RulesObject[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRulesObject)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- rules-content/rulesObject.test.ts
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: prior count + 12, zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/rules-content/rulesObject.ts src/rules-content/rulesObject.test.ts
git commit -m "Add rules object model, ability mechanics schema, and validation"
```

---

### Task 2: `rules_objects` table and DM-only CRUD RPCs

**Files:**
- Create: `app/supabase/migrations/0006_rules_objects.sql`
- Create: `app/tests/integration/rules-objects.rpc.test.ts`

**Interfaces:**
- Consumes: `public.campaigns`, `public.is_campaign_member` (earlier migrations)
- Produces: table `public.rules_objects` (`id uuid`, `campaign_id uuid`, `type text`, `source text`, `name text`, `description text`, `mechanics jsonb`, `created_by uuid`, `created_at timestamptz`); RPCs `create_rules_object(p_campaign_id uuid, p_type text, p_name text, p_description text, p_mechanics jsonb) returns public.rules_objects`, `update_rules_object(p_id uuid, p_name text, p_description text, p_mechanics jsonb) returns public.rules_objects`, `delete_rules_object(p_id uuid) returns void` — all DM-only. Task 3's `api.ts` calls these by exact name/params.

**Prerequisite:** Docker running + `npx supabase start`.

- [ ] **Step 1: Write the migration**

Create `app/supabase/migrations/0006_rules_objects.sql`:

```sql
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

  insert into public.rules_objects (campaign_id, type, source, name, description, mechanics)
  values (p_campaign_id, p_type, 'homebrew', p_name, p_description, p_mechanics)
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
```

- [ ] **Step 2: Apply the migration locally**

```bash
cd app
npx supabase status   # confirm the stack is up; npx supabase start if not
npx supabase db reset
```

Expected: "Finished supabase db reset" with no SQL errors (re-applies 0001–0006).

- [ ] **Step 3: Write the integration test**

Create `app/tests/integration/rules-objects.rpc.test.ts` — same two-user pattern as `battle-map-tokens.rpc.test.ts` (same `createTestUserClient` helper, same env var contract, same cascade-safe `afterAll` deleting the DM's campaigns first):

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

const MECHANICS = {
  actionCost: 'action',
  resourceCost: 1,
  targeting: 'single',
  range: 6,
  damageDice: '2d6',
}

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

describe('rules object RPCs', () => {
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

  async function dmCampaign(name: string): Promise<string> {
    const { data } = (await dm.client
      .rpc('create_campaign', { p_name: name })
      .single()) as RpcSingleResult<Row>
    return data!.id
  }

  it('lets the DM create, update, read, and delete an ability', async () => {
    const campaignId = await dmCampaign('Content A')

    const { data: created, error: createError } = (await dm.client
      .rpc('create_rules_object', {
        p_campaign_id: campaignId,
        p_type: 'ability',
        p_name: 'Firebolt',
        p_description: 'A dart of flame.',
        p_mechanics: MECHANICS,
      })
      .single()) as RpcSingleResult<Row>
    expect(createError).toBeNull()
    expect(created?.name).toBe('Firebolt')
    expect(created?.source).toBe('homebrew')

    const { data: updated, error: updateError } = (await dm.client
      .rpc('update_rules_object', {
        p_id: created!.id,
        p_name: 'Frostbolt',
        p_description: 'A dart of ice.',
        p_mechanics: { ...MECHANICS, damageDice: '2d8' },
      })
      .single()) as RpcSingleResult<Row>
    expect(updateError).toBeNull()
    expect(updated?.name).toBe('Frostbolt')

    const { data: rows } = await dm.client
      .from('rules_objects')
      .select('*')
      .eq('campaign_id', campaignId)
    expect(rows).toHaveLength(1)

    const { error: deleteError } = await dm.client.rpc('delete_rules_object', { p_id: created!.id })
    expect(deleteError).toBeNull()

    const { data: afterDelete } = await dm.client
      .from('rules_objects')
      .select('*')
      .eq('campaign_id', campaignId)
    expect(afterDelete).toHaveLength(0)
  })

  it('rejects a non-DM member creating or updating content', async () => {
    const campaignId = await dmCampaign('Content B')
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaignId })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', {
      p_code: (invitation as { code: string }).code,
    })

    const { error: createError } = await player.client.rpc('create_rules_object', {
      p_campaign_id: campaignId,
      p_type: 'ability',
      p_name: 'Sneaky',
      p_description: '',
      p_mechanics: MECHANICS,
    })
    expect(createError).not.toBeNull()

    const { data: dmObject } = (await dm.client
      .rpc('create_rules_object', {
        p_campaign_id: campaignId,
        p_type: 'ability',
        p_name: 'Guarded',
        p_description: '',
        p_mechanics: MECHANICS,
      })
      .single()) as RpcSingleResult<Row>
    const { error: updateError } = await player.client.rpc('update_rules_object', {
      p_id: dmObject!.id,
      p_name: 'Hacked',
      p_description: '',
      p_mechanics: MECHANICS,
    })
    expect(updateError).not.toBeNull()
  })

  it('lets a fellow campaign member read rules objects (RLS), even if not DM', async () => {
    const campaignId = await dmCampaign('Content C')
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaignId })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', {
      p_code: (invitation as { code: string }).code,
    })
    await dm.client.rpc('create_rules_object', {
      p_campaign_id: campaignId,
      p_type: 'ability',
      p_name: 'Readable',
      p_description: '',
      p_mechanics: MECHANICS,
    })

    const { data: rows, error } = await player.client
      .from('rules_objects')
      .select('*')
      .eq('campaign_id', campaignId)
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

Expected: PASS — 16 tests (13 existing + 3 new rules-object tests).

- [ ] **Step 5: Run the unit suite and build**

```bash
npm test
npm run build
```

Expected: unchanged from Task 1 (no `src/` change here), zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0006_rules_objects.sql tests/integration/rules-objects.rpc.test.ts
git commit -m "Add rules_objects table, RLS, and DM-only CRUD RPCs"
```

---

### Task 3: API layer — rules object CRUD

**Files:**
- Create: `app/src/rules-content/api.ts`
- Create: `app/src/rules-content/api.test.ts`

**Interfaces:**
- Consumes: `RulesObject`, `AbilityMechanics`, `parseRulesObjects` from `./rulesObject` (Task 1); `supabase` from `../lib/supabaseClient`
- Produces: `listCampaignRulesObjects(campaignId: string): Promise<RulesObject[]>`, `createAbility(campaignId: string, name: string, description: string, mechanics: AbilityMechanics): Promise<RulesObject>`, `updateAbility(id: string, name: string, description: string, mechanics: AbilityMechanics): Promise<RulesObject>`, `deleteRulesObject(id: string): Promise<void>`, plus a `toRulesObject(raw): RulesObject` single-row parse helper. Tasks 4/5 import these.

- [ ] **Step 1: Write the failing tests**

Create `app/src/rules-content/api.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}))

import { supabase } from '../lib/supabaseClient'
import { createAbility, deleteRulesObject, listCampaignRulesObjects, updateAbility } from './api'

const MECHANICS = {
  actionCost: 'action' as const,
  resourceCost: 1,
  targeting: 'single' as const,
  range: 6,
  damageDice: '2d6',
}
const FIXTURE = {
  id: 'r1',
  campaign_id: 'c1',
  type: 'ability' as const,
  source: 'homebrew' as const,
  name: 'Firebolt',
  description: 'A dart of flame.',
  mechanics: MECHANICS,
}

describe('listCampaignRulesObjects', () => {
  it('selects rules objects for the campaign and parses them', async () => {
    const eq = vi.fn().mockResolvedValue({ data: [FIXTURE], error: null })
    const select = vi.fn().mockReturnValue({ eq })
    vi.mocked(supabase.from).mockReturnValue({ select } as never)

    const result = await listCampaignRulesObjects('c1')

    expect(supabase.from).toHaveBeenCalledWith('rules_objects')
    expect(eq).toHaveBeenCalledWith('campaign_id', 'c1')
    expect(result).toEqual([FIXTURE])
  })
})

describe('createAbility', () => {
  it('calls create_rules_object with type "ability" and the mechanics', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: FIXTURE, error: null } as never)

    const result = await createAbility('c1', 'Firebolt', 'A dart of flame.', MECHANICS)

    expect(supabase.rpc).toHaveBeenCalledWith('create_rules_object', {
      p_campaign_id: 'c1',
      p_type: 'ability',
      p_name: 'Firebolt',
      p_description: 'A dart of flame.',
      p_mechanics: MECHANICS,
    })
    expect(result).toEqual(FIXTURE)
  })

  it('throws when the RPC errors', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Only the current DM can create content for this campaign' },
    } as never)
    await expect(createAbility('c1', 'X', '', MECHANICS)).rejects.toThrow(
      'Only the current DM can create content',
    )
  })
})

describe('updateAbility', () => {
  it('calls update_rules_object with the id and new fields', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { ...FIXTURE, name: 'Frostbolt' },
      error: null,
    } as never)

    const result = await updateAbility('r1', 'Frostbolt', 'ice', MECHANICS)

    expect(supabase.rpc).toHaveBeenCalledWith('update_rules_object', {
      p_id: 'r1',
      p_name: 'Frostbolt',
      p_description: 'ice',
      p_mechanics: MECHANICS,
    })
    expect(result.name).toBe('Frostbolt')
  })
})

describe('deleteRulesObject', () => {
  it('calls delete_rules_object', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never)
    await deleteRulesObject('r1')
    expect(supabase.rpc).toHaveBeenCalledWith('delete_rules_object', { p_id: 'r1' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- rules-content/api.test.ts
```

Expected: FAIL with "Cannot find module './api'".

- [ ] **Step 3: Implement `api.ts`**

Create `app/src/rules-content/api.ts`:

```typescript
import { supabase } from '../lib/supabaseClient'
import { parseRulesObjects, type AbilityMechanics, type RulesObject } from './rulesObject'

function toRulesObject(raw: unknown): RulesObject {
  const [parsed] = parseRulesObjects([raw])
  if (!parsed) throw new Error('Received a malformed rules object from the server')
  return parsed
}

export async function listCampaignRulesObjects(campaignId: string): Promise<RulesObject[]> {
  const { data, error } = await supabase
    .from('rules_objects')
    .select('*')
    .eq('campaign_id', campaignId)
  if (error) throw new Error(error.message)
  return parseRulesObjects(data)
}

export async function createAbility(
  campaignId: string,
  name: string,
  description: string,
  mechanics: AbilityMechanics,
): Promise<RulesObject> {
  const { data, error } = await supabase.rpc('create_rules_object', {
    p_campaign_id: campaignId,
    p_type: 'ability',
    p_name: name,
    p_description: description,
    p_mechanics: mechanics,
  })
  if (error) throw new Error(error.message)
  return toRulesObject(data)
}

export async function updateAbility(
  id: string,
  name: string,
  description: string,
  mechanics: AbilityMechanics,
): Promise<RulesObject> {
  const { data, error } = await supabase.rpc('update_rules_object', {
    p_id: id,
    p_name: name,
    p_description: description,
    p_mechanics: mechanics,
  })
  if (error) throw new Error(error.message)
  return toRulesObject(data)
}

export async function deleteRulesObject(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_rules_object', { p_id: id })
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- rules-content/api.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: all green, zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/rules-content/api.ts src/rules-content/api.test.ts
git commit -m "Add rules object CRUD API layer"
```

---

### Task 4: Content Editor panel — list, create, remove

**Files:**
- Create: `app/src/rules-content/AbilityForm.tsx`
- Create: `app/src/rules-content/RulesContentEditorPanel.tsx`
- Create: `app/src/rules-content/RulesContentEditorPanel.test.tsx`
- Modify: `app/src/campaigns/CampaignDashboardPage.tsx`

**Interfaces:**
- Consumes: `RulesObject`, `AbilityMechanics`, `ACTION_COSTS`, `TARGETINGS`, `emptyAbilityMechanics`, `isValidAbilityMechanics` from `../rules-content/rulesObject`; `listCampaignRulesObjects`, `createAbility`, `deleteRulesObject` from `./api`
- Produces: `<AbilityForm value={AbilityMechanics} name={string} description={string} onChange={...} />` reusable structured form (used again in Task 5 for editing); `<RulesContentEditorPanel campaignId={string} />` rendered from `CampaignDashboardPage`.

- [ ] **Step 1: Write the failing test for the panel**

Create `app/src/rules-content/RulesContentEditorPanel.test.tsx`:

```typescript
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RulesObject } from './rulesObject'

afterEach(() => cleanup())

vi.mock('./api', () => ({
  listCampaignRulesObjects: vi.fn(),
  createAbility: vi.fn(),
  deleteRulesObject: vi.fn(),
}))

import { createAbility, deleteRulesObject, listCampaignRulesObjects } from './api'
import { RulesContentEditorPanel } from './RulesContentEditorPanel'

const FIREBOLT: RulesObject = {
  id: 'r1',
  campaign_id: 'c1',
  type: 'ability',
  source: 'homebrew',
  name: 'Firebolt',
  description: 'A dart of flame.',
  mechanics: { actionCost: 'action', resourceCost: 1, targeting: 'single', range: 6, damageDice: '2d6' },
}

describe('RulesContentEditorPanel', () => {
  it('lists existing abilities', async () => {
    vi.mocked(listCampaignRulesObjects).mockResolvedValue([FIREBOLT])
    render(<RulesContentEditorPanel campaignId="c1" />)
    expect(await screen.findByText(/firebolt/i, { selector: 'li' })).toBeInTheDocument()
  })

  it('creates an ability and shows it in the list', async () => {
    vi.mocked(listCampaignRulesObjects).mockResolvedValue([])
    vi.mocked(createAbility).mockResolvedValue(FIREBOLT)
    render(<RulesContentEditorPanel campaignId="c1" />)

    fireEvent.change(await screen.findByLabelText(/ability name/i), { target: { value: 'Firebolt' } })
    fireEvent.click(screen.getByRole('button', { name: /add ability/i }))

    await waitFor(() =>
      expect(createAbility).toHaveBeenCalledWith('c1', 'Firebolt', expect.any(String), expect.objectContaining({ actionCost: expect.any(String) })),
    )
    expect(await screen.findByText(/firebolt/i, { selector: 'li' })).toBeInTheDocument()
  })

  it('removes an ability', async () => {
    vi.mocked(listCampaignRulesObjects).mockResolvedValue([FIREBOLT])
    vi.mocked(deleteRulesObject).mockResolvedValue(undefined)
    render(<RulesContentEditorPanel campaignId="c1" />)

    fireEvent.click(await screen.findByRole('button', { name: /remove/i }))

    await waitFor(() => expect(deleteRulesObject).toHaveBeenCalledWith('r1'))
  })

  it('shows an error when create fails', async () => {
    vi.mocked(listCampaignRulesObjects).mockResolvedValue([])
    vi.mocked(createAbility).mockRejectedValueOnce(
      new Error('Only the current DM can create content for this campaign'),
    )
    render(<RulesContentEditorPanel campaignId="c1" />)

    fireEvent.change(await screen.findByLabelText(/ability name/i), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: /add ability/i }))

    expect(await screen.findByText(/only the current dm can create content/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npm test -- RulesContentEditorPanel.test.tsx
```

Expected: FAIL with "Cannot find module './RulesContentEditorPanel'".

- [ ] **Step 3: Implement `AbilityForm.tsx`**

Create `app/src/rules-content/AbilityForm.tsx`:

```typescript
import { ACTION_COSTS, TARGETINGS, type AbilityMechanics } from './rulesObject'

type AbilityFormProps = {
  name: string
  description: string
  mechanics: AbilityMechanics
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
  onMechanicsChange: (mechanics: AbilityMechanics) => void
}

export function AbilityForm({
  name,
  description,
  mechanics,
  onNameChange,
  onDescriptionChange,
  onMechanicsChange,
}: AbilityFormProps) {
  function setField<K extends keyof AbilityMechanics>(key: K, value: AbilityMechanics[K]) {
    onMechanicsChange({ ...mechanics, [key]: value })
  }

  return (
    <div className="ability-form">
      <label htmlFor="ability-name">Ability name</label>
      <input id="ability-name" value={name} onChange={(e) => onNameChange(e.target.value)} required />

      <label htmlFor="ability-description">Description</label>
      <textarea
        id="ability-description"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
      />

      <label htmlFor="ability-action-cost">Action cost</label>
      <select
        id="ability-action-cost"
        value={mechanics.actionCost}
        onChange={(e) => setField('actionCost', e.target.value as AbilityMechanics['actionCost'])}
      >
        {ACTION_COSTS.map((cost) => (
          <option key={cost} value={cost}>
            {cost}
          </option>
        ))}
      </select>

      <label htmlFor="ability-resource-cost">Resource cost</label>
      <input
        id="ability-resource-cost"
        type="number"
        value={mechanics.resourceCost}
        onChange={(e) => setField('resourceCost', Number(e.target.value))}
      />

      <label htmlFor="ability-targeting">Targeting</label>
      <select
        id="ability-targeting"
        value={mechanics.targeting}
        onChange={(e) => setField('targeting', e.target.value as AbilityMechanics['targeting'])}
      >
        {TARGETINGS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <label htmlFor="ability-range">Range (cells)</label>
      <input
        id="ability-range"
        type="number"
        value={mechanics.range}
        onChange={(e) => setField('range', Number(e.target.value))}
      />

      <label htmlFor="ability-damage-dice">Damage dice (e.g. 2d6, blank for none)</label>
      <input
        id="ability-damage-dice"
        value={mechanics.damageDice}
        onChange={(e) => setField('damageDice', e.target.value)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Implement `RulesContentEditorPanel.tsx` (list + create + remove)**

Create `app/src/rules-content/RulesContentEditorPanel.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { AbilityForm } from './AbilityForm'
import { createAbility, deleteRulesObject, listCampaignRulesObjects } from './api'
import { emptyAbilityMechanics, isValidAbilityMechanics, type AbilityMechanics, type RulesObject } from './rulesObject'

type RulesContentEditorPanelProps = {
  campaignId: string
}

export function RulesContentEditorPanel({ campaignId }: RulesContentEditorPanelProps) {
  const [objects, setObjects] = useState<RulesObject[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mechanics, setMechanics] = useState<AbilityMechanics>(emptyAbilityMechanics)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listCampaignRulesObjects(campaignId)
      .then(setObjects)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : String(loadError)),
      )
  }, [campaignId])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!isValidAbilityMechanics(mechanics)) {
      setError('Ability mechanics are out of the allowed range (check cost, range, and damage dice).')
      return
    }
    try {
      const created = await createAbility(campaignId, name, description, mechanics)
      setObjects((current) => [...current, created])
      setName('')
      setDescription('')
      setMechanics(emptyAbilityMechanics())
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleRemove(id: string) {
    setError(null)
    try {
      await deleteRulesObject(id)
      setObjects((current) => current.filter((object) => object.id !== id))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="rules-content-editor-panel">
      <h2>Abilities</h2>
      <ul>
        {objects.map((object) => (
          <li key={object.id}>
            {object.name} — {object.mechanics.actionCost}, {object.mechanics.targeting}, range{' '}
            {object.mechanics.range}
            {object.mechanics.damageDice ? `, ${object.mechanics.damageDice}` : ''}
            <button type="button" onClick={() => void handleRemove(object.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreate}>
        <AbilityForm
          name={name}
          description={description}
          mechanics={mechanics}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onMechanicsChange={setMechanics}
        />
        <button type="submit">Add ability</button>
      </form>
      {error && <div className="error-message">{error}</div>}
    </section>
  )
}
```

- [ ] **Step 5: Run the panel test to verify it passes**

```bash
npm test -- RulesContentEditorPanel.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Render the panel from the Campaign Dashboard**

Modify `app/src/campaigns/CampaignDashboardPage.tsx`:

```typescript
import { useParams } from 'react-router'
import { BattleMapListPanel } from '../battle-maps/BattleMapListPanel'
import { RulesContentEditorPanel } from '../rules-content/RulesContentEditorPanel'
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
      <RulesContentEditorPanel campaignId={campaignId} />
      <p>Session views are not built yet.</p>
    </main>
  )
}
```

- [ ] **Step 7: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: all green (prior + the panel's 4 tests), zero TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/rules-content/AbilityForm.tsx src/rules-content/RulesContentEditorPanel.tsx src/rules-content/RulesContentEditorPanel.test.tsx src/campaigns/CampaignDashboardPage.tsx
git commit -m "Add Rules Content Editor panel (list/create/remove abilities)"
```

---

### Task 5: Edit an existing ability

**Files:**
- Modify: `app/src/rules-content/RulesContentEditorPanel.tsx`
- Modify: `app/src/rules-content/RulesContentEditorPanel.test.tsx`

**Interfaces:**
- Consumes: `updateAbility` from `./api` (Task 3); the existing `AbilityForm`
- Produces: an in-place edit mode in `RulesContentEditorPanel` — clicking "Edit" on a listed ability loads it into the form; the submit button becomes "Save changes" and calls `updateAbility`; a "Cancel" control returns to create mode. Last task.

- [ ] **Step 1: Add the failing edit test**

Add to `app/src/rules-content/RulesContentEditorPanel.test.tsx` — add `updateAbility` to the `./api` mock and its import, then a test:

```typescript
// add updateAbility to the vi.mock('./api', ...) factory: updateAbility: vi.fn(),
// add to the import line: updateAbility

it('edits an existing ability and saves via updateAbility', async () => {
  vi.mocked(listCampaignRulesObjects).mockResolvedValue([FIREBOLT])
  vi.mocked(updateAbility).mockResolvedValue({ ...FIREBOLT, name: 'Frostbolt' })
  render(<RulesContentEditorPanel campaignId="c1" />)

  fireEvent.click(await screen.findByRole('button', { name: /edit/i }))

  const nameInput = screen.getByLabelText(/ability name/i)
  expect(nameInput).toHaveValue('Firebolt') // form populated from the row
  fireEvent.change(nameInput, { target: { value: 'Frostbolt' } })
  fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

  await waitFor(() =>
    expect(updateAbility).toHaveBeenCalledWith('r1', 'Frostbolt', expect.any(String), expect.any(Object)),
  )
  expect(await screen.findByText(/frostbolt/i, { selector: 'li' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npm test -- RulesContentEditorPanel.test.tsx
```

Expected: FAIL — there's no "Edit" button / edit mode yet.

- [ ] **Step 3: Add edit mode to `RulesContentEditorPanel.tsx`**

Modify `app/src/rules-content/RulesContentEditorPanel.tsx`. Add an `editingId` state; an "Edit" button per list item that loads the object into the form and sets `editingId`; branch the submit handler on `editingId` (create vs `updateAbility`); a "Cancel" control; the submit button label reflects the mode. Add the `updateAbility` import. The full new file:

```typescript
import { useEffect, useState } from 'react'
import { AbilityForm } from './AbilityForm'
import { createAbility, deleteRulesObject, listCampaignRulesObjects, updateAbility } from './api'
import { emptyAbilityMechanics, isValidAbilityMechanics, type AbilityMechanics, type RulesObject } from './rulesObject'

type RulesContentEditorPanelProps = {
  campaignId: string
}

export function RulesContentEditorPanel({ campaignId }: RulesContentEditorPanelProps) {
  const [objects, setObjects] = useState<RulesObject[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mechanics, setMechanics] = useState<AbilityMechanics>(emptyAbilityMechanics)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listCampaignRulesObjects(campaignId)
      .then(setObjects)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : String(loadError)),
      )
  }, [campaignId])

  function resetForm() {
    setEditingId(null)
    setName('')
    setDescription('')
    setMechanics(emptyAbilityMechanics())
  }

  function startEditing(object: RulesObject) {
    setError(null)
    setEditingId(object.id)
    setName(object.name)
    setDescription(object.description)
    setMechanics(object.mechanics)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (!isValidAbilityMechanics(mechanics)) {
      setError('Ability mechanics are out of the allowed range (check cost, range, and damage dice).')
      return
    }
    try {
      if (editingId) {
        const saved = await updateAbility(editingId, name, description, mechanics)
        setObjects((current) => current.map((object) => (object.id === saved.id ? saved : object)))
      } else {
        const created = await createAbility(campaignId, name, description, mechanics)
        setObjects((current) => [...current, created])
      }
      resetForm()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function handleRemove(id: string) {
    setError(null)
    try {
      await deleteRulesObject(id)
      setObjects((current) => current.filter((object) => object.id !== id))
      if (editingId === id) resetForm()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="rules-content-editor-panel">
      <h2>Abilities</h2>
      <ul>
        {objects.map((object) => (
          <li key={object.id}>
            {object.name} — {object.mechanics.actionCost}, {object.mechanics.targeting}, range{' '}
            {object.mechanics.range}
            {object.mechanics.damageDice ? `, ${object.mechanics.damageDice}` : ''}
            <button type="button" onClick={() => startEditing(object)}>
              Edit
            </button>
            <button type="button" onClick={() => void handleRemove(object.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <AbilityForm
          name={name}
          description={description}
          mechanics={mechanics}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onMechanicsChange={setMechanics}
        />
        <button type="submit">{editingId ? 'Save changes' : 'Add ability'}</button>
        {editingId && (
          <button type="button" onClick={resetForm}>
            Cancel
          </button>
        )}
      </form>
      {error && <div className="error-message">{error}</div>}
    </section>
  )
}
```

- [ ] **Step 4: Run the panel test to verify it passes**

```bash
npm test -- RulesContentEditorPanel.test.tsx
```

Expected: PASS (all prior panel tests + the new edit test). Note the create test's submit button is still "Add ability" (create mode), so it's unaffected.

- [ ] **Step 5: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: all green, zero TypeScript errors.

- [ ] **Step 6: Verify the DB round-trip against the local stack**

```bash
npx supabase status
SUPABASE_SERVICE_ROLE_KEY=<key> SUPABASE_ANON_KEY=<key> npm run test:db
```

Expected: PASS, 16 tests (the rules-object integration tests from Task 2 still green — confirms the DB layer the editor drives, including update, is intact).

- [ ] **Step 7: Commit**

```bash
git add src/rules-content/RulesContentEditorPanel.tsx src/rules-content/RulesContentEditorPanel.test.tsx
git commit -m "Add in-place edit of an existing ability to the Rules Content Editor"
```

---

## Post-plan state

After Task 5, a DM opens a Campaign, authors abilities with structured mechanical fields (action cost, resource cost, targeting, range, damage dice) plus freeform name/description, edits and removes them, all persisted campaign-scoped and validated against balance-constraint bounds — the tracer-bullet of the Rules Content Editor working end to end through the shared `AbilityMechanics` (Procedural Ability Template MVP) shape. Deferred, each a follow-up plan reusing the same `rules_objects` table and pattern: the other six content types (spell/monster/item/encounter/trait/resource) with their own structured forms; richer Procedural Ability Template fields (tags, scaling, multi-effect); AI-assisted generation writing to this same table with `source = 'ai-generated'` (issue #8, also gated on the OpenAI API-key workflow); and the Session Log usage-snapshot behavior once live sessions exist. DM-visibility gating of the panel is deferred (the panel shows to all campaign members; the RPCs reject non-DM writes — the accepted `InvitePanel`/terrain/token pattern). No renderer, camera, or character files are touched by this plan.
