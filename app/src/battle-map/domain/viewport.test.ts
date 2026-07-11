import { expect, it } from 'vitest'
import { mapDetailMode, visibleChunkAddresses } from './viewport'

it('adds one prefetch ring and clamps chunks to the Battle Map', () => {
  expect(visibleChunkAddresses({ minX: 190, minZ: 190, maxX: 200, maxZ: 200 }, 64, 1)).toEqual([
    { column: 4, row: 4 },
    { column: 5, row: 4 },
    { column: 6, row: 4 },
    { column: 4, row: 5 },
    { column: 5, row: 5 },
    { column: 6, row: 5 },
    { column: 4, row: 6 },
    { column: 5, row: 6 },
    { column: 6, row: 6 },
  ])
})

it('adds exactly one prefetch ring at chunk-aligned maximum bounds', () => {
  expect(visibleChunkAddresses({ minX: 32, minZ: 32, maxX: 64, maxZ: 64 }, 64, 1)).toEqual([
    { column: 0, row: 0 },
    { column: 1, row: 0 },
    { column: 2, row: 0 },
    { column: 0, row: 1 },
    { column: 1, row: 1 },
    { column: 2, row: 1 },
    { column: 0, row: 2 },
    { column: 1, row: 2 },
    { column: 2, row: 2 },
  ])
})

it.each([-1, 0.5])('rejects an invalid prefetch ring count of %s', (prefetchRings) => {
  expect(() =>
    visibleChunkAddresses({ minX: 32, minZ: 32, maxX: 64, maxZ: 64 }, 64, prefetchRings),
  ).toThrow(RangeError)
})

it('uses the overview when more than 96 cells are visible', () => {
  expect(mapDetailMode(97)).toBe('overview')
  expect(mapDetailMode(96)).toBe('detail')
})
