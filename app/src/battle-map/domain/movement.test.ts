import { expect, it } from 'vitest'
import type { GridCell } from './grid'
import { straightGridPath } from './movement'

it('creates a stable snapped path including both endpoints', () => {
  const from: GridCell = { column: 2, row: 2 }
  const to: GridCell = { column: 5, row: 4 }

  expect(straightGridPath(from, to)).toEqual([
    { column: 2, row: 2 },
    { column: 3, row: 3 },
    { column: 4, row: 3 },
    { column: 5, row: 4 },
  ])
})

it('returns the endpoint once when movement stays in the same Grid Cell', () => {
  expect(straightGridPath({ column: 8, row: 13 }, { column: 8, row: 13 })).toEqual([
    { column: 8, row: 13 },
  ])
})

it('creates horizontal and vertical paths', () => {
  expect(straightGridPath({ column: 1, row: 3 }, { column: 4, row: 3 })).toEqual([
    { column: 1, row: 3 },
    { column: 2, row: 3 },
    { column: 3, row: 3 },
    { column: 4, row: 3 },
  ])
  expect(straightGridPath({ column: 4, row: 5 }, { column: 4, row: 2 })).toEqual([
    { column: 4, row: 5 },
    { column: 4, row: 4 },
    { column: 4, row: 3 },
    { column: 4, row: 2 },
  ])
})

it('creates a stable steep path', () => {
  expect(straightGridPath({ column: 2, row: 2 }, { column: 4, row: 6 })).toEqual([
    { column: 2, row: 2 },
    { column: 2, row: 3 },
    { column: 3, row: 4 },
    { column: 3, row: 5 },
    { column: 4, row: 6 },
  ])
})

it('creates a stable reverse path', () => {
  expect(straightGridPath({ column: 5, row: 4 }, { column: 2, row: 2 })).toEqual([
    { column: 5, row: 4 },
    { column: 4, row: 3 },
    { column: 3, row: 3 },
    { column: 2, row: 2 },
  ])
})

it('uses deterministic strict tie-breaking', () => {
  expect(straightGridPath({ column: 2, row: 2 }, { column: 4, row: 3 })).toEqual([
    { column: 2, row: 2 },
    { column: 3, row: 2 },
    { column: 4, row: 3 },
  ])
  expect(straightGridPath({ column: 4, row: 3 }, { column: 2, row: 2 })).toEqual([
    { column: 4, row: 3 },
    { column: 3, row: 3 },
    { column: 2, row: 2 },
  ])
})

it('includes both Battle Map boundary cells without leaving the map', () => {
  const path = straightGridPath({ column: 0, row: 0 }, { column: 199, row: 199 })

  expect(path).toHaveLength(200)
  expect(path[0]).toEqual({ column: 0, row: 0 })
  expect(path.at(-1)).toEqual({ column: 199, row: 199 })
  expect(
    path.every(
      ({ column, row }) => column >= 0 && column < 200 && row >= 0 && row < 200,
    ),
  ).toBe(true)
})

it.each([
  [{ column: -1, row: 0 }, { column: 0, row: 0 }],
  [{ column: 0, row: 0 }, { column: 200, row: 0 }],
  [{ column: 0.5, row: 0 }, { column: 0, row: 0 }],
] satisfies readonly [GridCell, GridCell][])('rejects invalid endpoints', (from, to) => {
  expect(() => straightGridPath(from, to)).toThrow(RangeError)
})
