import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

import { supabase } from '../lib/supabaseClient'
import { createCampaign, createInvitation, listMyCampaigns, redeemInvitation } from './api'

describe('createCampaign', () => {
  it('calls the create_campaign RPC and returns the campaign', async () => {
    const fakeCampaign = { id: 'c1', name: 'The Fallen Spire', dm_user_id: 'u1', created_at: 'now' }
    vi.mocked(supabase.rpc).mockResolvedValue({ data: fakeCampaign, error: null } as never)

    const result = await createCampaign('The Fallen Spire')

    expect(supabase.rpc).toHaveBeenCalledWith('create_campaign', { p_name: 'The Fallen Spire' })
    expect(result).toEqual(fakeCampaign)
  })

  it('throws when the RPC returns an error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    } as never)

    await expect(createCampaign('Bad')).rejects.toThrow('boom')
  })
})

describe('listMyCampaigns', () => {
  it('selects campaigns visible under RLS', async () => {
    const fakeCampaigns = [{ id: 'c1', name: 'The Fallen Spire', dm_user_id: 'u1', created_at: 'now' }]
    const order = vi.fn().mockResolvedValue({ data: fakeCampaigns, error: null })
    const select = vi.fn().mockReturnValue({ order })
    vi.mocked(supabase.from).mockReturnValue({ select } as never)

    const result = await listMyCampaigns()

    expect(supabase.from).toHaveBeenCalledWith('campaigns')
    expect(select).toHaveBeenCalledWith('*')
    expect(result).toEqual(fakeCampaigns)
  })
})

describe('createInvitation', () => {
  it('calls the create_campaign_invitation RPC and returns the code', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { id: 'i1', campaign_id: 'c1', code: 'ABCD1234' },
      error: null,
    } as never)

    const result = await createInvitation('c1')

    expect(supabase.rpc).toHaveBeenCalledWith('create_campaign_invitation', {
      p_campaign_id: 'c1',
    })
    expect(result).toEqual({ code: 'ABCD1234' })
  })
})

describe('redeemInvitation', () => {
  it('calls the redeem_campaign_invitation RPC and returns the campaign id', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { campaign_id: 'c1', user_id: 'u2', role: 'player' },
      error: null,
    } as never)

    const result = await redeemInvitation('ABCD1234')

    expect(supabase.rpc).toHaveBeenCalledWith('redeem_campaign_invitation', {
      p_code: 'ABCD1234',
    })
    expect(result).toEqual({ campaignId: 'c1' })
  })

  it('surfaces a friendly error when the code is invalid', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Invitation code not found' },
    } as never)

    await expect(redeemInvitation('BADCODE1')).rejects.toThrow('Invitation code not found')
  })
})
