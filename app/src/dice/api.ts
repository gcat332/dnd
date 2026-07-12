import { supabase } from '../lib/supabaseClient'
import { parseDiceRolls, type DiceNotation, type DiceRoll } from './diceNotation'

const DEFAULT_LIMIT = 20

function toDiceRoll(raw: unknown): DiceRoll {
  const [parsed] = parseDiceRolls([raw])
  if (!parsed) throw new Error('Received a malformed dice roll from the server')
  return parsed
}

export async function rollDice(campaignId: string, notation: DiceNotation): Promise<DiceRoll> {
  const { data, error } = await supabase.rpc('roll_dice', {
    p_campaign_id: campaignId,
    p_count: notation.count,
    p_sides: notation.sides,
    p_modifier: notation.modifier,
  })
  if (error) throw new Error(error.message)
  return toDiceRoll(data)
}

export async function listRecentRolls(campaignId: string, limit = DEFAULT_LIMIT): Promise<DiceRoll[]> {
  const { data, error } = await supabase
    .from('dice_rolls')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return parseDiceRolls(data)
}
