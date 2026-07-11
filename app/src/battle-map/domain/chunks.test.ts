import { describe, expect, it } from 'vitest'
import { chunkAddressForCell, chunkBounds, chunkCellSpan } from './chunks'

describe('Render Chunks', () => {
  it('uses 32 cells when a cell is 64 texture pixels', () => {
    expect(chunkCellSpan(64)).toBe(32)
    expect(chunkBounds({ column: 6, row: 6 }, 64)).toEqual({
      minColumn: 192,
      minRow: 192,
      maxColumnExclusive: 200,
      maxRowExclusive: 200,
    })
  })

  it('uses 16 cells when the texture-pixel cap wins', () => {
    expect(chunkCellSpan(128)).toBe(16)
    expect(chunkAddressForCell({ column: 31, row: 48 }, 128)).toEqual({ column: 1, row: 3 })
  })

  it('rejects a Grid Cell larger than the 2048-pixel cap', () => {
    expect(() => chunkCellSpan(2049)).toThrow(RangeError)
  })

  it.each([
    { column: Number.NaN, row: 0 },
    { column: Number.POSITIVE_INFINITY, row: 0 },
    { column: 0, row: Number.NEGATIVE_INFINITY },
    { column: 0.5, row: 0 },
    { column: 0, row: 1.25 },
    { column: -1, row: 0 },
    { column: 0, row: -1 },
  ])('rejects invalid Render Chunk address $column:$row', (address) => {
    expect(() => chunkBounds(address, 64)).toThrow(RangeError)
  })
})
