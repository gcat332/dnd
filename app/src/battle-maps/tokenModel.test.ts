import { describe, expect, it } from 'vitest'
import { isTokenCellOnMap, parseTokens, tokenToRenderState, type Token } from './tokenModel'

const TOKEN: Token = {
  id: 't1',
  battle_map_id: 'map-1',
  label: 'Goblin',
  color: '#4f9e63',
  column: 100,
  row: 100,
  elevation: 0,
}

describe('isTokenCellOnMap', () => {
  it('accepts integer cells inside the 200x200 map', () => {
    expect(isTokenCellOnMap(0, 0)).toBe(true)
    expect(isTokenCellOnMap(199, 199)).toBe(true)
  })

  it('rejects out-of-range or non-integer cells', () => {
    expect(isTokenCellOnMap(200, 0)).toBe(false)
    expect(isTokenCellOnMap(0, -1)).toBe(false)
    expect(isTokenCellOnMap(1.5, 0)).toBe(false)
  })
})

describe('tokenToRenderState', () => {
  it('maps a persisted token to the renderer shape, always visible', () => {
    expect(tokenToRenderState(TOKEN)).toEqual({
      id: 't1',
      label: 'Goblin',
      cell: { column: 100, row: 100 },
      elevation: 0,
      color: '#4f9e63',
      visible: true,
    })
  })
})

describe('parseTokens', () => {
  it('returns [] for non-array input', () => {
    expect(parseTokens(null)).toEqual([])
    expect(parseTokens({})).toEqual([])
  })

  it('keeps well-formed rows and drops malformed ones', () => {
    const result = parseTokens([TOKEN, { id: 'bad' }, 7, { ...TOKEN, id: 't2' }])
    expect(result).toEqual([TOKEN, { ...TOKEN, id: 't2' }])
  })
})
