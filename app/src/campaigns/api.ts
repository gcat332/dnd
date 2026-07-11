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
