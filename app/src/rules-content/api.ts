import { supabase } from '../lib/supabaseClient'
import { parseRulesObjects, type AbilityMechanics, type RulesObject } from './rulesObject'

function toRulesObject(raw: unknown): RulesObject {
  const [parsed] = parseRulesObjects([raw])
  if (!parsed) throw new Error('Received a malformed rules object from the server')
  return parsed
}

export async function listCampaignRulesObjects(campaignId: string): Promise<RulesObject[]> {
  const { data, error } = await supabase
    .from('rules_objects')
    .select('*')
    .eq('campaign_id', campaignId)
  if (error) throw new Error(error.message)
  return parseRulesObjects(data)
}

export async function createAbility(
  campaignId: string,
  name: string,
  description: string,
  mechanics: AbilityMechanics,
): Promise<RulesObject> {
  const { data, error } = await supabase.rpc('create_rules_object', {
    p_campaign_id: campaignId,
    p_type: 'ability',
    p_name: name,
    p_description: description,
    p_mechanics: mechanics,
  })
  if (error) throw new Error(error.message)
  return toRulesObject(data)
}

export async function updateAbility(
  id: string,
  name: string,
  description: string,
  mechanics: AbilityMechanics,
): Promise<RulesObject> {
  const { data, error } = await supabase.rpc('update_rules_object', {
    p_id: id,
    p_name: name,
    p_description: description,
    p_mechanics: mechanics,
  })
  if (error) throw new Error(error.message)
  return toRulesObject(data)
}

export async function deleteRulesObject(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_rules_object', { p_id: id })
  if (error) throw new Error(error.message)
}
