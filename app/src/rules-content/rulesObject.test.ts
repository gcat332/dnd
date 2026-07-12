import { describe, expect, it } from 'vitest'
import {
  emptyAbilityMechanics,
  isValidAbilityMechanics,
  parseRulesObjects,
  type AbilityMechanics,
  type RulesObject,
} from './rulesObject'

const MECHANICS: AbilityMechanics = {
  actionCost: 'action',
  resourceCost: 1,
  targeting: 'single',
  range: 6,
  damageDice: '2d6',
}

const ABILITY: RulesObject = {
  id: 'r1',
  campaign_id: 'c1',
  type: 'ability',
  source: 'homebrew',
  name: 'Firebolt',
  description: 'A dart of flame.',
  mechanics: MECHANICS,
}

describe('isValidAbilityMechanics', () => {
  it('accepts well-formed mechanics', () => {
    expect(isValidAbilityMechanics(MECHANICS)).toBe(true)
  })

  it('accepts an empty damage-dice string (non-damaging ability)', () => {
    expect(isValidAbilityMechanics({ ...MECHANICS, damageDice: '' })).toBe(true)
  })

  it('rejects an unknown action cost or targeting', () => {
    expect(isValidAbilityMechanics({ ...MECHANICS, actionCost: 'teleport' })).toBe(false)
    expect(isValidAbilityMechanics({ ...MECHANICS, targeting: 'everywhere' })).toBe(false)
  })

  it('rejects negative or non-integer resourceCost / range (balance bounds)', () => {
    expect(isValidAbilityMechanics({ ...MECHANICS, resourceCost: -1 })).toBe(false)
    expect(isValidAbilityMechanics({ ...MECHANICS, range: 1.5 })).toBe(false)
  })

  it('rejects resourceCost or range above the balance cap', () => {
    expect(isValidAbilityMechanics({ ...MECHANICS, resourceCost: 21 })).toBe(false)
    expect(isValidAbilityMechanics({ ...MECHANICS, range: 201 })).toBe(false)
  })

  it('rejects a malformed damage-dice string', () => {
    expect(isValidAbilityMechanics({ ...MECHANICS, damageDice: 'banana' })).toBe(false)
    expect(isValidAbilityMechanics({ ...MECHANICS, damageDice: '2d' })).toBe(false)
  })

  it('accepts valid dice notation with an optional modifier', () => {
    expect(isValidAbilityMechanics({ ...MECHANICS, damageDice: '1d20' })).toBe(true)
    expect(isValidAbilityMechanics({ ...MECHANICS, damageDice: '3d8+4' })).toBe(true)
  })
})

describe('emptyAbilityMechanics', () => {
  it('returns a valid default', () => {
    expect(isValidAbilityMechanics(emptyAbilityMechanics())).toBe(true)
  })
})

describe('parseRulesObjects', () => {
  it('returns [] for non-array input', () => {
    expect(parseRulesObjects(null)).toEqual([])
    expect(parseRulesObjects({})).toEqual([])
  })

  it('keeps well-formed rows and drops malformed ones', () => {
    const result = parseRulesObjects([ABILITY, { id: 'bad' }, 7, { ...ABILITY, id: 'r2' }])
    expect(result).toEqual([ABILITY, { ...ABILITY, id: 'r2' }])
  })

  it('drops a row whose mechanics fail validation', () => {
    const result = parseRulesObjects([{ ...ABILITY, mechanics: { ...MECHANICS, range: -5 } }])
    expect(result).toEqual([])
  })
})
