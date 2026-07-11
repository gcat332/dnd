import { supabase } from '../lib/supabaseClient'

export type BattleMap = {
  id: string
  campaign_id: string
  name: string
  created_by: string
  created_at: string
}

export async function createBattleMap(campaignId: string, name: string): Promise<BattleMap> {
  const { data, error } = await supabase.rpc('create_battle_map', {
    p_campaign_id: campaignId,
    p_name: name,
  })
  if (error) throw new Error(error.message)
  return data as BattleMap
}

export async function listCampaignBattleMaps(campaignId: string): Promise<BattleMap[]> {
  const { data, error } = await supabase
    .from('battle_maps')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as BattleMap[]
}

export async function getBattleMap(mapId: string): Promise<BattleMap | null> {
  const { data, error } = await supabase.from('battle_maps').select('*').eq('id', mapId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as BattleMap | null) ?? null
}
