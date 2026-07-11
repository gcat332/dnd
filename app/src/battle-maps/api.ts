import { supabase } from '../lib/supabaseClient'
import { parseTerrainFeatures, type TerrainFeature } from './terrain'

export type BattleMap = {
  id: string
  campaign_id: string
  name: string
  created_by: string
  created_at: string
  terrain: TerrainFeature[]
}

type RawBattleMap = Omit<BattleMap, 'terrain'> & { terrain: unknown }

function toBattleMap(raw: RawBattleMap): BattleMap {
  return { ...raw, terrain: parseTerrainFeatures(raw.terrain) }
}

export async function createBattleMap(campaignId: string, name: string): Promise<BattleMap> {
  const { data, error } = await supabase.rpc('create_battle_map', {
    p_campaign_id: campaignId,
    p_name: name,
  })
  if (error) throw new Error(error.message)
  return toBattleMap(data as RawBattleMap)
}

export async function listCampaignBattleMaps(campaignId: string): Promise<BattleMap[]> {
  const { data, error } = await supabase
    .from('battle_maps')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as RawBattleMap[]).map(toBattleMap)
}

export async function getBattleMap(mapId: string): Promise<BattleMap | null> {
  const { data, error } = await supabase.from('battle_maps').select('*').eq('id', mapId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toBattleMap(data as RawBattleMap) : null
}

export async function setBattleMapTerrain(
  mapId: string,
  features: TerrainFeature[],
): Promise<BattleMap> {
  const { data, error } = await supabase.rpc('set_battle_map_terrain', {
    p_map_id: mapId,
    p_terrain: features,
  })
  if (error) throw new Error(error.message)
  return toBattleMap(data as RawBattleMap)
}
