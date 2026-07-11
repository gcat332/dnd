import { supabase } from '../lib/supabaseClient'

export type Campaign = {
  id: string
  name: string
  dm_user_id: string
  created_at: string
}

export async function createCampaign(name: string): Promise<Campaign> {
  const { data, error } = await supabase.rpc('create_campaign', { p_name: name })
  if (error) throw new Error(error.message)
  return data as Campaign
}

export async function listMyCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase.from('campaigns').select('*').order('created_at', {
    ascending: false,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as Campaign[]
}

export async function createInvitation(campaignId: string): Promise<{ code: string }> {
  const { data, error } = await supabase.rpc('create_campaign_invitation', {
    p_campaign_id: campaignId,
  })
  if (error) throw new Error(error.message)
  return { code: (data as { code: string }).code }
}

export async function redeemInvitation(code: string): Promise<{ campaignId: string }> {
  const { data, error } = await supabase.rpc('redeem_campaign_invitation', { p_code: code })
  if (error) throw new Error(error.message)
  return { campaignId: (data as { campaign_id: string }).campaign_id }
}
