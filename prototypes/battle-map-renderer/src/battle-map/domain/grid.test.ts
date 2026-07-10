import { describe, expect, it } from 'vitest'
import { gridToWorld, worldToGrid } from './grid'

describe('grid coordinates', () => {
  it('round-trips through the center of a Grid Cell', () => {
    expect(worldToGrid(gridToWorld({ column: 199, row: 199 }))).toEqual({ column: 199, row: 199 })
  })

  it('floors World Points at Grid Cell edges', () => {
    expect(worldToGrid({ x: 31.999, z: 48 })).toEqual({ column: 31, row: 48 })
  })

  it('rejects a cell outside the logical Battle Map', () => {
    expect(() => gridToWorld({ column: 200, row: 0 })).toThrow(RangeError)
  })

  it('rejects World Points at the 200 by 200 boundary', () => {
    expect(() => worldToGrid({ x: 0, z: 200 })).toThrow(RangeError)
  })
})
