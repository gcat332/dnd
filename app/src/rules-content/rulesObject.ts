export const RULES_OBJECT_TYPES = [
  'ability',
  'spell',
  'monster',
  'item',
  'encounter',
  'trait',
  'resource',
] as const
export type RulesObjectType = (typeof RULES_OBJECT_TYPES)[number]

export const RULES_OBJECT_SOURCES = ['starter', 'homebrew', 'ai-generated'] as const
export type RulesObjectSource = (typeof RULES_OBJECT_SOURCES)[number]

export const ACTION_COSTS = ['action', 'bonus', 'reaction', 'free'] as const
export type ActionCost = (typeof ACTION_COSTS)[number]

export const TARGETINGS = ['self', 'single', 'area'] as const
export type Targeting = (typeof TARGETINGS)[number]

export type AbilityMechanics = {
  actionCost: ActionCost
  resourceCost: number
  targeting: Targeting
  range: number
  damageDice: string
}

export type RulesObject = {
  id: string
  campaign_id: string
  type: RulesObjectType
  source: RulesObjectSource
  name: string
  description: string
  mechanics: AbilityMechanics
}

// Balance-constraint caps (ticket #7 "balance-constraint bounds checking").
const MAX_RESOURCE_COST = 20
const MAX_RANGE_CELLS = 200
// e.g. "2d6", "1d20", "3d8+4" — count d sides, optional +modifier.
const DICE_PATTERN = /^\d+d\d+(\+\d+)?$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

export function isValidAbilityMechanics(value: unknown): value is AbilityMechanics {
  if (!isRecord(value)) return false
  if (!ACTION_COSTS.includes(value.actionCost as ActionCost)) return false
  if (!TARGETINGS.includes(value.targeting as Targeting)) return false
  if (!isIntInRange(value.resourceCost, 0, MAX_RESOURCE_COST)) return false
  if (!isIntInRange(value.range, 0, MAX_RANGE_CELLS)) return false
  if (typeof value.damageDice !== 'string') return false
  if (value.damageDice !== '' && !DICE_PATTERN.test(value.damageDice)) return false
  return true
}

export function emptyAbilityMechanics(): AbilityMechanics {
  return { actionCost: 'action', resourceCost: 0, targeting: 'single', range: 1, damageDice: '' }
}

function isRulesObject(value: unknown): value is RulesObject {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.campaign_id === 'string' &&
    RULES_OBJECT_TYPES.includes(value.type as RulesObjectType) &&
    RULES_OBJECT_SOURCES.includes(value.source as RulesObjectSource) &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    isValidAbilityMechanics(value.mechanics)
  )
}

export function parseRulesObjects(value: unknown): RulesObject[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRulesObject)
}
