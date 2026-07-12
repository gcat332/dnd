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
