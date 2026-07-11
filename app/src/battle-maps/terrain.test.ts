import { describe, expect, it } from 'vitest'
import {
  isValidTerrainFeature,
  MAX_TERRAIN_FEATURES,
  parseTerrainFeatures,
  terrainFeatureBox,
  type TerrainFeature,
} from './terrain'

const WALL: TerrainFeature = {
  id: 'f1',
  kind: 'wall',
  column: 90,
  row: 93,
  widthCells: 18,
  depthCells: 1,
  heightCells: 3,
}

describe('isValidTerrainFeature', () => {
  it('accepts a well-formed feature fully on the map', () => {
    expect(isValidTerrainFeature(WALL)).toBe(true)
  })

  it('rejects an unknown kind', () => {
    expect(isValidTerrainFeature({ ...WALL, kind: 'moat' })).toBe(false)
  })

  it('rejects non-integer or negative cell coordinates', () => {
    expect(isValidTerrainFeature({ ...WALL, column: 1.5 })).toBe(false)
    expect(isValidTerrainFeature({ ...WALL, row: -1 })).toBe(false)
  })

  it('rejects a footprint that runs off the 200x200 map', () => {
    expect(isValidTerrainFeature({ ...WALL, column: 199, widthCells: 5 })).toBe(false)
    expect(isValidTerrainFeature({ ...WALL, row: 199, depthCells: 5 })).toBe(false)
  })

  it('rejects non-positive sizes', () => {
    expect(isValidTerrainFeature({ ...WALL, widthCells: 0 })).toBe(false)
    expect(isValidTerrainFeature({ ...WALL, heightCells: 0 })).toBe(false)
  })
})

describe('parseTerrainFeatures', () => {
  it('returns [] for non-array input', () => {
    expect(parseTerrainFeatures(null)).toEqual([])
    expect(parseTerrainFeatures({})).toEqual([])
    expect(parseTerrainFeatures('nope')).toEqual([])
  })

  it('keeps valid features and drops invalid ones', () => {
    const result = parseTerrainFeatures([WALL, { kind: 'moat' }, 42, { ...WALL, id: 'f2' }])
    expect(result).toEqual([WALL, { ...WALL, id: 'f2' }])
  })

  it('caps at MAX_TERRAIN_FEATURES', () => {
    const many = Array.from({ length: MAX_TERRAIN_FEATURES + 10 }, (_, i) => ({ ...WALL, id: `f${i}` }))
    expect(parseTerrainFeatures(many)).toHaveLength(MAX_TERRAIN_FEATURES)
  })
})

describe('terrainFeatureBox', () => {
  it('centers the box on its footprint and rests it on the floor', () => {
    // WALL: NW corner (90,93), 18x1 footprint, height 3.
    // center x = 90 + 18/2 = 99, center z = 93 + 1/2 = 93.5, y = height/2 = 1.5
    expect(terrainFeatureBox(WALL)).toEqual({
      position: [99, 1.5, 93.5],
      scale: [18, 3, 1],
    })
  })

  it('handles a single-cell pillar', () => {
    const pillar: TerrainFeature = {
      id: 'p1',
      kind: 'pillar',
      column: 100,
      row: 100,
      widthCells: 1,
      depthCells: 1,
      heightCells: 4,
    }
    expect(terrainFeatureBox(pillar)).toEqual({
      position: [100.5, 2, 100.5],
      scale: [1, 4, 1],
    })
  })
})
