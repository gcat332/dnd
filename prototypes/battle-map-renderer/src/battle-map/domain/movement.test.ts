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
