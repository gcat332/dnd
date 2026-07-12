import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

import { supabase } from '../lib/supabaseClient'
import {
  createBattleMap,
  createToken,
  deleteToken,
  getBattleMap,
  listBattleMapTokens,
  listCampaignBattleMaps,
  moveToken,
  setBattleMapTerrain,
} from './api'
import type { TerrainFeature } from './terrain'

const FIXTURE_TERRAIN: TerrainFeature[] = [
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
})

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
    expect(select).toHaveBeenCalledWith('*')
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
