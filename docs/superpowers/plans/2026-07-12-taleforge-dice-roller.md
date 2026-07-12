# Taleforge Dice Roller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any campaign member roll dice by standard notation (e.g. `2d6+3`), with the result computed server-side (uncheatable), persisted to a campaign-scoped roll history, and shown in a dice panel with the individual die results and total. This is the "Light Automation" dice feature and the first slice of loggable gameplay events.

**Architecture:** A `dice_rolls` table (campaign-scoped), written only through a `SECURITY DEFINER` Postgres RPC `roll_dice` that computes the random result **in the database** (`random()` server-side, so the client can never dictate the value) and gates on `is_campaign_member` (every member rolls their own dice — not DM-only). A pure TypeScript module owns dice-notation parsing/validation and result-shaping; a `DiceRollerPanel` on the Campaign Dashboard drives the RPC and shows recent rolls. New `app/src/dice/` module; no battle-map, camera, or character files touched.

**Tech Stack:** Same as the rest of the app (Vite, React 19, TypeScript, Vitest, `@supabase/supabase-js`, `react-router`). No 3D/renderer. No new dependencies.

## Global Constraints

- **Server-authoritative rolls (issue #9 intent).** The roll value is generated inside the `roll_dice` RPC using Postgres `random()`; the client sends only the dice notation, never a result. Issue #9's letter said dice route through a Supabase Edge Function — this slice deliberately uses a `SECURITY DEFINER` Postgres RPC instead (same gateway pattern as all five shipped subsystems, genuinely server-authoritative, no first-Deno-Edge-Function lift). The Edge Function is deferred to when an external call needs it (AI generation, #8). This deviation is flagged in `AGENT_COORDINATION.md` for the human to revisit.
- **Member-gated, not DM-only.** `roll_dice` is authorized for any `is_campaign_member` of the target campaign (everyone rolls dice), unlike the DM-only content/terrain/token/map writes. Reads (roll history) use a member-read RLS policy.
- **Coordination:** Codex is concurrently in `app/src/battle-map/**` (camera/scene/DimensionalTerrain/useBattleMapView/BattleMapView), `characters/`, `public/assets/`. This plan must NOT touch any of those. It touches only: a new migration, a new `app/src/dice/**` module, and `app/src/campaigns/CampaignDashboardPage.tsx` (adding one panel).
- **Supported notation (V1):** `NdM` and `NdM+K` / `NdM-K` where N is the die count (1–100), M is the sides (must be one of 2,3,4,6,8,10,12,20,100), and K is an optional integer modifier (−1000…1000). Reject anything else. This bounds the roll size and keeps the die types to standard polyhedrals.
- Migrations are append-only: this plan adds `0007_dice_rolls.sql`; it must never edit `0001`–`0006`. Include inline `GRANT`s (SELECT on the table, EXECUTE on the RPC) to `authenticated` (hosted Supabase revokes Data API privileges by default — established in `0002`, reapplied through `0006`).
- Rolls are append-only history: no update/delete RPC in this slice. A roll, once made, stands (it's a record of what happened, aligning with the permanent Session Log intent from issue #2 — this `dice_rolls` table is a forerunner that a later Session Log plan may fold in).
- New integration test files keep `fileParallelism: false` (already set in `vitest.integration.config.ts`).
- No placeholder/mock **data** ships — every UI reads/writes the real Supabase project; mocking `../lib/supabaseClient` inside a unit test is expected TDD isolation.
- Docker + local Supabase are needed for Task 2 and Task 4's `test:db` verification (`npx supabase start`). Tasks 1 and 3 are pure TS/React.

---

## File Structure

```
app/
  supabase/migrations/
    0007_dice_rolls.sql                # dice_rolls table, RLS, roll_dice RPC, grants (Task 2)
  tests/integration/
    dice-rolls.rpc.test.ts              # real Postgres integration test (Task 2)
  src/
    dice/
      diceNotation.ts                   # parse/validate dice notation, result types (Task 1)
      diceNotation.test.ts
      api.ts                            # rollDice, listRecentRolls (Task 3)
      api.test.ts
      DiceRollerPanel.tsx                # notation input + roll + recent-rolls list (Task 4)
      DiceRollerPanel.test.tsx
    campaigns/
      CampaignDashboardPage.tsx          # modified: render <DiceRollerPanel> (Task 4)
```

---

### Task 1: Dice notation parsing and result model

**Files:**
- Create: `app/src/dice/diceNotation.ts`
- Create: `app/src/dice/diceNotation.test.ts`

**Interfaces:**
- Consumes: nothing (pure module)
- Produces: `ALLOWED_DIE_SIDES` (readonly `[2,3,4,6,8,10,12,20,100]`); `type DiceNotation = { count: number; sides: number; modifier: number }`; `type DiceRoll = { id: string; campaign_id: string; roller_id: string; notation: string; results: number[]; modifier: number; total: number; created_at: string }`; `parseDiceNotation(input: string): DiceNotation | null` (returns null for anything invalid or out of bounds); `parseDiceRolls(value: unknown): DiceRoll[]`. Tasks 3/4 import these.

- [ ] **Step 1: Write the failing tests**

Create `app/src/dice/diceNotation.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { parseDiceNotation, parseDiceRolls, type DiceRoll } from './diceNotation'

describe('parseDiceNotation', () => {
  it('parses a bare NdM', () => {
    expect(parseDiceNotation('2d6')).toEqual({ count: 2, sides: 6, modifier: 0 })
  })

  it('parses a positive and negative modifier', () => {
    expect(parseDiceNotation('1d20+5')).toEqual({ count: 1, sides: 20, modifier: 5 })
    expect(parseDiceNotation('3d8-2')).toEqual({ count: 3, sides: 8, modifier: -2 })
  })

  it('tolerates surrounding whitespace and uppercase D', () => {
    expect(parseDiceNotation('  4D10 ')).toEqual({ count: 4, sides: 10, modifier: 0 })
  })

  it('rejects a non-standard die size', () => {
    expect(parseDiceNotation('1d7')).toBeNull()
    expect(parseDiceNotation('2d5')).toBeNull()
  })

  it('rejects a count below 1 or above 100', () => {
    expect(parseDiceNotation('0d6')).toBeNull()
    expect(parseDiceNotation('101d6')).toBeNull()
  })

  it('rejects a modifier beyond +/-1000', () => {
    expect(parseDiceNotation('1d6+1001')).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(parseDiceNotation('')).toBeNull()
    expect(parseDiceNotation('d6')).toBeNull()
    expect(parseDiceNotation('2d')).toBeNull()
    expect(parseDiceNotation('banana')).toBeNull()
    expect(parseDiceNotation('2d6+')).toBeNull()
    expect(parseDiceNotation('2d6+3+4')).toBeNull()
  })
})

describe('parseDiceRolls', () => {
  const ROLL: DiceRoll = {
    id: 'd1',
    campaign_id: 'c1',
    roller_id: 'u1',
    notation: '2d6+3',
    results: [4, 5],
    modifier: 3,
    total: 12,
    created_at: 'now',
  }

  it('returns [] for non-array input', () => {
    expect(parseDiceRolls(null)).toEqual([])
    expect(parseDiceRolls({})).toEqual([])
  })

  it('keeps well-formed rows and drops malformed ones', () => {
    const result = parseDiceRolls([ROLL, { id: 'bad' }, 7, { ...ROLL, id: 'd2' }])
    expect(result).toEqual([ROLL, { ...ROLL, id: 'd2' }])
  })

  it('drops a row whose results is not an array of numbers', () => {
    expect(parseDiceRolls([{ ...ROLL, results: 'nope' }])).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd app
npm test -- dice/diceNotation.test.ts
```

Expected: FAIL with "Cannot find module './diceNotation'".

- [ ] **Step 3: Implement `diceNotation.ts`**

Create `app/src/dice/diceNotation.ts`:

```typescript
export const ALLOWED_DIE_SIDES = [2, 3, 4, 6, 8, 10, 12, 20, 100] as const

const MAX_DICE_COUNT = 100
const MAX_MODIFIER = 1000
// N d M with optional +K / -K, case-insensitive on the d, surrounding space trimmed.
const NOTATION_PATTERN = /^(\d+)d(\d+)([+-]\d+)?$/i

export type DiceNotation = {
  count: number
  sides: number
  modifier: number
}

export type DiceRoll = {
  id: string
  campaign_id: string
  roller_id: string
  notation: string
  results: number[]
  modifier: number
  total: number
  created_at: string
}

export function parseDiceNotation(input: string): DiceNotation | null {
  const match = NOTATION_PATTERN.exec(input.trim())
  if (!match) return null
  const count = Number(match[1])
  const sides = Number(match[2])
  const modifier = match[3] ? Number(match[3]) : 0
  if (!Number.isInteger(count) || count < 1 || count > MAX_DICE_COUNT) return null
  if (!(ALLOWED_DIE_SIDES as readonly number[]).includes(sides)) return null
  if (Math.abs(modifier) > MAX_MODIFIER) return null
  return { count, sides, modifier }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDiceRoll(value: unknown): value is DiceRoll {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.campaign_id === 'string' &&
    typeof value.roller_id === 'string' &&
    typeof value.notation === 'string' &&
    Array.isArray(value.results) &&
    value.results.every((r) => typeof r === 'number') &&
    typeof value.modifier === 'number' &&
    typeof value.total === 'number' &&
    typeof value.created_at === 'string'
  )
}

export function parseDiceRolls(value: unknown): DiceRoll[] {
  if (!Array.isArray(value)) return []
  return value.filter(isDiceRoll)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- dice/diceNotation.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: prior count + 11, zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/dice/diceNotation.ts src/dice/diceNotation.test.ts
git commit -m "Add dice notation parsing and roll result model"
```

---

### Task 2: `dice_rolls` table and server-authoritative `roll_dice` RPC

**Files:**
- Create: `app/supabase/migrations/0007_dice_rolls.sql`
- Create: `app/tests/integration/dice-rolls.rpc.test.ts`

**Interfaces:**
- Consumes: `public.campaigns`, `public.is_campaign_member` (earlier migrations)
- Produces: table `public.dice_rolls` (`id uuid`, `campaign_id uuid`, `roller_id uuid`, `notation text`, `results int[]`, `modifier int`, `total int`, `created_at timestamptz`); RPC `roll_dice(p_campaign_id uuid, p_count int, p_sides int, p_modifier int) returns public.dice_rolls` — member-gated, computes the roll server-side. Task 3's `api.ts` calls it by exact name/params.

**Prerequisite:** Docker running + `npx supabase start`.

- [ ] **Step 1: Write the migration**

Create `app/supabase/migrations/0007_dice_rolls.sql`:

```sql
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
```

- [ ] **Step 2: Apply the migration locally**

```bash
cd app
npx supabase status   # confirm the stack is up; npx supabase start if not
npx supabase db reset
```

Expected: "Finished supabase db reset" with no SQL errors (re-applies 0001–0007).

- [ ] **Step 3: Write the integration test**

Create `app/tests/integration/dice-rolls.rpc.test.ts` — same two-user pattern as the other integration tests (same `createTestUserClient` helper, same env var contract, same cascade-safe `afterAll` deleting the DM's campaigns first). Note the roll is random, so assert on invariants (result count, per-die bounds, total = sum + modifier), not exact values:

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

type DiceRollRow = {
  id: string
  roller_id: string
  results: number[]
  modifier: number
  total: number
  notation: string
}
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

describe('roll_dice RPC', () => {
  let dm: Awaited<ReturnType<typeof createTestUserClient>>
  let player: Awaited<ReturnType<typeof createTestUserClient>>
  let outsider: Awaited<ReturnType<typeof createTestUserClient>>

  beforeAll(async () => {
    dm = await createTestUserClient(`dm-${Date.now()}@example.test`)
    player = await createTestUserClient(`player-${Date.now()}@example.test`)
    outsider = await createTestUserClient(`outsider-${Date.now()}@example.test`)
  })

  afterAll(async () => {
    const { error: campaignsError } = await adminClient
      .from('campaigns')
      .delete()
      .eq('dm_user_id', dm.userId)
    if (campaignsError) throw campaignsError
    await adminClient.auth.admin.deleteUser(dm.userId)
    await adminClient.auth.admin.deleteUser(player.userId)
    await adminClient.auth.admin.deleteUser(outsider.userId)
  })

  async function dmCampaignWithPlayer(name: string): Promise<string> {
    const { data: campaign } = (await dm.client
      .rpc('create_campaign', { p_name: name })
      .single()) as RpcSingleResult<{ id: string }>
    const { data: invitation } = (await dm.client
      .rpc('create_campaign_invitation', { p_campaign_id: campaign!.id })
      .single()) as RpcSingleResult<{ code: string }>
    await player.client.rpc('redeem_campaign_invitation', {
      p_code: (invitation as { code: string }).code,
    })
    return campaign!.id
  }

  it('lets a member roll, computing the result server-side within bounds', async () => {
    const campaignId = await dmCampaignWithPlayer('Dice A')

    const { data: roll, error } = (await player.client
      .rpc('roll_dice', { p_campaign_id: campaignId, p_count: 3, p_sides: 6, p_modifier: 2 })
      .single()) as RpcSingleResult<DiceRollRow>

    expect(error).toBeNull()
    expect(roll?.roller_id).toBe(player.userId)
    expect(roll?.results).toHaveLength(3)
    for (const die of roll!.results) {
      expect(die).toBeGreaterThanOrEqual(1)
      expect(die).toBeLessThanOrEqual(6)
    }
    const sum = roll!.results.reduce((a, b) => a + b, 0)
    expect(roll?.total).toBe(sum + 2)
    expect(roll?.notation).toBe('3d6+2')
  })

  it('rejects a non-member (outsider) rolling in the campaign', async () => {
    const campaignId = await dmCampaignWithPlayer('Dice B')

    const { error } = await outsider.client.rpc('roll_dice', {
      p_campaign_id: campaignId,
      p_count: 1,
      p_sides: 20,
      p_modifier: 0,
    })
    expect(error).not.toBeNull()
  })

  it('rejects an unsupported die size', async () => {
    const campaignId = await dmCampaignWithPlayer('Dice C')
    const { error } = await dm.client.rpc('roll_dice', {
      p_campaign_id: campaignId,
      p_count: 1,
      p_sides: 7,
      p_modifier: 0,
    })
    expect(error).not.toBeNull()
  })

  it('lets a fellow member read the campaign roll history (RLS)', async () => {
    const campaignId = await dmCampaignWithPlayer('Dice D')
    await dm.client.rpc('roll_dice', { p_campaign_id: campaignId, p_count: 1, p_sides: 20, p_modifier: 0 })

    const { data: rows, error } = await player.client
      .from('dice_rolls')
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

Expected: PASS — the existing integration tests plus 4 new dice tests.

- [ ] **Step 5: Run the unit suite and build**

```bash
npm test
npm run build
```

Expected: unchanged from Task 1 (no `src/` change here), zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0007_dice_rolls.sql tests/integration/dice-rolls.rpc.test.ts
git commit -m "Add dice_rolls table and server-authoritative roll_dice RPC"
```

---

### Task 3: API layer — roll and list rolls

**Files:**
- Create: `app/src/dice/api.ts`
- Create: `app/src/dice/api.test.ts`

**Interfaces:**
- Consumes: `DiceNotation`, `DiceRoll`, `parseDiceRolls` from `./diceNotation` (Task 1); `supabase` from `../lib/supabaseClient`
- Produces: `rollDice(campaignId: string, notation: DiceNotation): Promise<DiceRoll>` (calls `roll_dice` with the parsed count/sides/modifier), `listRecentRolls(campaignId: string, limit?: number): Promise<DiceRoll[]>` (reads `dice_rolls` for the campaign, newest first, capped), plus a `toDiceRoll(raw): DiceRoll` parse helper. Task 4 imports these.

- [ ] **Step 1: Write the failing tests**

Create `app/src/dice/api.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}))

import { supabase } from '../lib/supabaseClient'
import { listRecentRolls, rollDice } from './api'

const FIXTURE = {
  id: 'd1',
  campaign_id: 'c1',
  roller_id: 'u1',
  notation: '2d6+3',
  results: [4, 5],
  modifier: 3,
  total: 12,
  created_at: 'now',
}

describe('rollDice', () => {
  it('calls roll_dice with the parsed count/sides/modifier', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: FIXTURE, error: null } as never)

    const result = await rollDice('c1', { count: 2, sides: 6, modifier: 3 })

    expect(supabase.rpc).toHaveBeenCalledWith('roll_dice', {
      p_campaign_id: 'c1',
      p_count: 2,
      p_sides: 6,
      p_modifier: 3,
    })
    expect(result).toEqual(FIXTURE)
  })

  it('throws when the RPC errors', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Only a member of this campaign can roll dice here' },
    } as never)
    await expect(rollDice('c1', { count: 1, sides: 20, modifier: 0 })).rejects.toThrow(
      'Only a member of this campaign can roll dice',
    )
  })
})

describe('listRecentRolls', () => {
  it('reads dice rolls for the campaign, newest first, with a limit', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [FIXTURE], error: null })
    const order = vi.fn().mockReturnValue({ limit })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    vi.mocked(supabase.from).mockReturnValue({ select } as never)

    const result = await listRecentRolls('c1')

    expect(supabase.from).toHaveBeenCalledWith('dice_rolls')
    expect(eq).toHaveBeenCalledWith('campaign_id', 'c1')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(result).toEqual([FIXTURE])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- dice/api.test.ts
```

Expected: FAIL with "Cannot find module './api'".

- [ ] **Step 3: Implement `api.ts`**

Create `app/src/dice/api.ts`:

```typescript
import { supabase } from '../lib/supabaseClient'
import { parseDiceRolls, type DiceNotation, type DiceRoll } from './diceNotation'

const DEFAULT_LIMIT = 20

function toDiceRoll(raw: unknown): DiceRoll {
  const [parsed] = parseDiceRolls([raw])
  if (!parsed) throw new Error('Received a malformed dice roll from the server')
  return parsed
}

export async function rollDice(campaignId: string, notation: DiceNotation): Promise<DiceRoll> {
  const { data, error } = await supabase.rpc('roll_dice', {
    p_campaign_id: campaignId,
    p_count: notation.count,
    p_sides: notation.sides,
    p_modifier: notation.modifier,
  })
  if (error) throw new Error(error.message)
  return toDiceRoll(data)
}

export async function listRecentRolls(campaignId: string, limit = DEFAULT_LIMIT): Promise<DiceRoll[]> {
  const { data, error } = await supabase
    .from('dice_rolls')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return parseDiceRolls(data)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- dice/api.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: all green, zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/dice/api.ts src/dice/api.test.ts
git commit -m "Add dice roll API layer (roll + recent history)"
```

---

### Task 4: Dice Roller panel on the Campaign Dashboard

**Files:**
- Create: `app/src/dice/DiceRollerPanel.tsx`
- Create: `app/src/dice/DiceRollerPanel.test.tsx`
- Modify: `app/src/campaigns/CampaignDashboardPage.tsx`

**Interfaces:**
- Consumes: `parseDiceNotation`, `DiceRoll` from `./diceNotation`; `rollDice`, `listRecentRolls` from `./api`
- Produces: `<DiceRollerPanel campaignId={string} />` rendered from `CampaignDashboardPage`. Last task.

- [ ] **Step 1: Write the failing test**

Create `app/src/dice/DiceRollerPanel.test.tsx`:

```typescript
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DiceRoll } from './diceNotation'

afterEach(() => cleanup())

vi.mock('./api', () => ({
  rollDice: vi.fn(),
  listRecentRolls: vi.fn(),
}))

import { listRecentRolls, rollDice } from './api'
import { DiceRollerPanel } from './DiceRollerPanel'

const ROLL: DiceRoll = {
  id: 'd1',
  campaign_id: 'c1',
  roller_id: 'u1',
  notation: '2d6+3',
  results: [4, 5],
  modifier: 3,
  total: 12,
  created_at: 'now',
}

describe('DiceRollerPanel', () => {
  it('shows the recent roll history on load', async () => {
    vi.mocked(listRecentRolls).mockResolvedValue([ROLL])
    render(<DiceRollerPanel campaignId="c1" />)
    expect(await screen.findByText(/2d6\+3/)).toBeInTheDocument()
    expect(screen.getByText(/12/)).toBeInTheDocument()
  })

  it('rolls a valid notation and prepends the result', async () => {
    vi.mocked(listRecentRolls).mockResolvedValue([])
    vi.mocked(rollDice).mockResolvedValue(ROLL)
    render(<DiceRollerPanel campaignId="c1" />)

    fireEvent.change(screen.getByLabelText(/dice notation/i), { target: { value: '2d6+3' } })
    fireEvent.click(screen.getByRole('button', { name: /roll/i }))

    await waitFor(() =>
      expect(rollDice).toHaveBeenCalledWith('c1', { count: 2, sides: 6, modifier: 3 }),
    )
    expect(await screen.findByText(/2d6\+3/)).toBeInTheDocument()
  })

  it('shows a validation error for bad notation without calling the API', async () => {
    vi.mocked(listRecentRolls).mockResolvedValue([])
    render(<DiceRollerPanel campaignId="c1" />)

    fireEvent.change(screen.getByLabelText(/dice notation/i), { target: { value: '2d7' } })
    fireEvent.click(screen.getByRole('button', { name: /roll/i }))

    expect(await screen.findByText(/not a valid dice roll/i)).toBeInTheDocument()
    expect(rollDice).not.toHaveBeenCalled()
  })

  it('surfaces a server error', async () => {
    vi.mocked(listRecentRolls).mockResolvedValue([])
    vi.mocked(rollDice).mockRejectedValueOnce(
      new Error('Only a member of this campaign can roll dice here'),
    )
    render(<DiceRollerPanel campaignId="c1" />)

    fireEvent.change(screen.getByLabelText(/dice notation/i), { target: { value: '1d20' } })
    fireEvent.click(screen.getByRole('button', { name: /roll/i }))

    expect(await screen.findByText(/only a member of this campaign can roll/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npm test -- DiceRollerPanel.test.tsx
```

Expected: FAIL with "Cannot find module './DiceRollerPanel'".

- [ ] **Step 3: Implement `DiceRollerPanel`**

Create `app/src/dice/DiceRollerPanel.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { rollDice, listRecentRolls } from './api'
import { parseDiceNotation, type DiceRoll } from './diceNotation'

type DiceRollerPanelProps = {
  campaignId: string
}

export function DiceRollerPanel({ campaignId }: DiceRollerPanelProps) {
  const [rolls, setRolls] = useState<DiceRoll[]>([])
  const [notation, setNotation] = useState('1d20')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listRecentRolls(campaignId)
      .then(setRolls)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : String(loadError)),
      )
  }, [campaignId])

  async function handleRoll(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const parsed = parseDiceNotation(notation)
    if (!parsed) {
      setError(`"${notation}" is not a valid dice roll (try e.g. 2d6+3).`)
      return
    }
    try {
      const roll = await rollDice(campaignId, parsed)
      setRolls((current) => [roll, ...current])
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="dice-roller-panel">
      <h2>Dice</h2>
      <form onSubmit={handleRoll}>
        <label htmlFor="dice-notation">Dice notation</label>
        <input
          id="dice-notation"
          value={notation}
          onChange={(event) => setNotation(event.target.value)}
        />
        <button type="submit">Roll</button>
      </form>
      {error && <div className="error-message">{error}</div>}
      <ul>
        {rolls.map((roll) => (
          <li key={roll.id}>
            {roll.notation}: [{roll.results.join(', ')}]
            {roll.modifier !== 0 ? ` ${roll.modifier > 0 ? '+' : ''}${roll.modifier}` : ''} = {roll.total}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: Run the panel test to verify it passes**

```bash
npm test -- DiceRollerPanel.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Render the panel from the Campaign Dashboard**

Modify `app/src/campaigns/CampaignDashboardPage.tsx` — add the import and render `<DiceRollerPanel>` alongside the existing panels (do not remove any). It currently renders `InvitePanel`, `BattleMapListPanel`, and `RulesContentEditorPanel`; add the import `import { DiceRollerPanel } from '../dice/DiceRollerPanel'` and place `<DiceRollerPanel campaignId={campaignId} />` after `RulesContentEditorPanel`.

- [ ] **Step 6: Run the full suite and build**

```bash
npm test
npm run build
```

Expected: all green (prior + the panel's 4 tests), zero TypeScript errors.

- [ ] **Step 7: Verify the DB round-trip against the local stack**

```bash
npx supabase status
SUPABASE_SERVICE_ROLE_KEY=<key> SUPABASE_ANON_KEY=<key> npm run test:db
```

Expected: PASS — the dice integration tests from Task 2 still green (confirms the DB layer the panel drives is intact).

- [ ] **Step 8: Commit**

```bash
git add src/dice/DiceRollerPanel.tsx src/dice/DiceRollerPanel.test.tsx src/campaigns/CampaignDashboardPage.tsx
git commit -m "Add Dice Roller panel to the campaign dashboard"
```

---

## Post-plan state

After Task 4, any campaign member opens a Campaign and rolls dice by standard notation, the result is computed server-side (uncheatable), persisted to a campaign-scoped append-only history, and shown in a dice panel with per-die results and total. Deferred: rolling from within the battle map / attaching a roll to a token or ability (needs the battle-map area, currently Codex's); folding `dice_rolls` into a broader Session Log (chat, combat events, rule warnings/overrides) when that subsystem is built (issue #2); advantage/disadvantage, exploding dice, and named/labeled rolls; and realtime push so other members see a roll appear live without reloading (issue #9's realtime work). The issue-#9 decision's literal "dice via Edge Function" is intentionally implemented here as a server-authoritative Postgres RPC — revisit if/when the Edge Function gateway is stood up for AI generation. No renderer, camera, or character files are touched by this plan.
