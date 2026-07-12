export const ALLOWED_DIE_SIDES = [2, 3, 4, 6, 8, 10, 12, 20, 100] as const

const MAX_DICE_COUNT = 100
const MAX_MODIFIER = 1000
// N d M with optional +K / -K, case-insensitive on the d, surrounding space trimmed.
const NOTATION_PATTERN = /^(\d+)d(\d+)([+-]\d+)?$/i

export type DiceNotation = {
  count: number
  sides: number
  modifier: number
}

export type DiceRoll = {
  id: string
  campaign_id: string
  roller_id: string
  notation: string
  results: number[]
  modifier: number
  total: number
  created_at: string
}

export function parseDiceNotation(input: string): DiceNotation | null {
  const match = NOTATION_PATTERN.exec(input.trim())
  if (!match) return null
  const count = Number(match[1])
  const sides = Number(match[2])
  const modifier = match[3] ? Number(match[3]) : 0
  if (!Number.isInteger(count) || count < 1 || count > MAX_DICE_COUNT) return null
  if (!(ALLOWED_DIE_SIDES as readonly number[]).includes(sides)) return null
  if (Math.abs(modifier) > MAX_MODIFIER) return null
  return { count, sides, modifier }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isDiceRoll(value: unknown): value is DiceRoll {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.campaign_id === 'string' &&
    typeof value.roller_id === 'string' &&
    typeof value.notation === 'string' &&
    Array.isArray(value.results) &&
    value.results.every((r) => typeof r === 'number') &&
    typeof value.modifier === 'number' &&
    typeof value.total === 'number' &&
    typeof value.created_at === 'string'
  )
}

export function parseDiceRolls(value: unknown): DiceRoll[] {
  if (!Array.isArray(value)) return []
  return value.filter(isDiceRoll)
}
