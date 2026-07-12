import { describe, expect, it } from 'vitest'
import { parseDiceNotation, parseDiceRolls, type DiceRoll } from './diceNotation'

describe('parseDiceNotation', () => {
  it('parses a bare NdM', () => {
    expect(parseDiceNotation('2d6')).toEqual({ count: 2, sides: 6, modifier: 0 })
  })

  it('parses a positive and negative modifier', () => {
    expect(parseDiceNotation('1d20+5')).toEqual({ count: 1, sides: 20, modifier: 5 })
    expect(parseDiceNotation('3d8-2')).toEqual({ count: 3, sides: 8, modifier: -2 })
  })

  it('tolerates surrounding whitespace and uppercase D', () => {
    expect(parseDiceNotation('  4D10 ')).toEqual({ count: 4, sides: 10, modifier: 0 })
  })

  it('rejects a non-standard die size', () => {
    expect(parseDiceNotation('1d7')).toBeNull()
    expect(parseDiceNotation('2d5')).toBeNull()
  })

  it('rejects a count below 1 or above 100', () => {
    expect(parseDiceNotation('0d6')).toBeNull()
    expect(parseDiceNotation('101d6')).toBeNull()
  })

  it('rejects a modifier beyond +/-1000', () => {
    expect(parseDiceNotation('1d6+1001')).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(parseDiceNotation('')).toBeNull()
    expect(parseDiceNotation('d6')).toBeNull()
    expect(parseDiceNotation('2d')).toBeNull()
    expect(parseDiceNotation('banana')).toBeNull()
    expect(parseDiceNotation('2d6+')).toBeNull()
    expect(parseDiceNotation('2d6+3+4')).toBeNull()
  })
})

describe('parseDiceRolls', () => {
  const ROLL: DiceRoll = {
    id: 'd1',
    campaign_id: 'c1',
    roller_id: 'u1',
    notation: '2d6+3',
    results: [4, 5],
    modifier: 3,
    total: 12,
    created_at: 'now',
  }

  it('returns [] for non-array input', () => {
    expect(parseDiceRolls(null)).toEqual([])
    expect(parseDiceRolls({})).toEqual([])
  })

  it('keeps well-formed rows and drops malformed ones', () => {
    const result = parseDiceRolls([ROLL, { id: 'bad' }, 7, { ...ROLL, id: 'd2' }])
    expect(result).toEqual([ROLL, { ...ROLL, id: 'd2' }])
  })

  it('drops a row whose results is not an array of numbers', () => {
    expect(parseDiceRolls([{ ...ROLL, results: 'nope' }])).toEqual([])
  })
})
