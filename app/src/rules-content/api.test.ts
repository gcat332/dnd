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
