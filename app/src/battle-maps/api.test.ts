import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

import { supabase } from '../lib/supabaseClient'
import { createBattleMap, getBattleMap, listCampaignBattleMaps, setBattleMapTerrain } from './api'
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
