import { expect, it } from 'vitest'
import { cellsCoveredByTemplate } from './effects'

it('returns stable cells for a circle template', () => {
  expect(
    cellsCoveredByTemplate({ kind: 'circle', origin: { column: 10, row: 10 }, radius: 1 }),
  ).toEqual([
    { column: 10, row: 9 },
    { column: 9, row: 10 },
    { column: 10, row: 10 },
    { column: 11, row: 10 },
    { column: 10, row: 11 },
  ])
})

it('returns a clipped line including its origin in path order', () => {
  expect(
    cellsCoveredByTemplate({
      kind: 'line',
      origin: { column: 198, row: 198 },
      direction: { column: 1, row: 1 },
      length: 4,
    }),
  ).toEqual([
    { column: 198, row: 198 },
    { column: 199, row: 199 },
  ])
})

it('returns a 90-degree cone in stable row-major order', () => {
  expect(
    cellsCoveredByTemplate({
      kind: 'cone',
      origin: { column: 10, row: 10 },
      direction: { column: 1, row: 0 },
      length: 2,
    }),
  ).toEqual([
    { column: 12, row: 8 },
    { column: 11, row: 9 },
    { column: 12, row: 9 },
    { column: 10, row: 10 },
    { column: 11, row: 10 },
    { column: 12, row: 10 },
    { column: 11, row: 11 },
    { column: 12, row: 11 },
    { column: 12, row: 12 },
  ])
})

it.each([
  {
    direction: { column: 0 as const, row: -1 as const },
    cells: [[8, 8], [9, 8], [10, 8], [11, 8], [12, 8], [9, 9], [10, 9], [11, 9], [10, 10]],
  },
  {
    direction: { column: 1 as const, row: -1 as const },
    cells: [[10, 8], [10, 9], [11, 9], [10, 10], [11, 10], [12, 10]],
  },
  {
    direction: { column: 1 as const, row: 0 as const },
    cells: [[12, 8], [11, 9], [12, 9], [10, 10], [11, 10], [12, 10], [11, 11], [12, 11], [12, 12]],
  },
  {
    direction: { column: 1 as const, row: 1 as const },
    cells: [[10, 10], [11, 10], [12, 10], [10, 11], [11, 11], [10, 12]],
  },
  {
    direction: { column: 0 as const, row: 1 as const },
    cells: [[10, 10], [9, 11], [10, 11], [11, 11], [8, 12], [9, 12], [10, 12], [11, 12], [12, 12]],
  },
  {
    direction: { column: -1 as const, row: 1 as const },
    cells: [[8, 10], [9, 10], [10, 10], [9, 11], [10, 11], [10, 12]],
  },
  {
    direction: { column: -1 as const, row: 0 as const },
    cells: [[8, 8], [8, 9], [9, 9], [8, 10], [9, 10], [10, 10], [8, 11], [9, 11], [8, 12]],
  },
  {
    direction: { column: -1 as const, row: -1 as const },
    cells: [[10, 8], [9, 9], [10, 9], [8, 10], [9, 10], [10, 10]],
  },
])('covers the $direction.column,$direction.row cone in row-major order', ({ direction, cells }) => {
  expect(
    cellsCoveredByTemplate({ kind: 'cone', origin: { column: 10, row: 10 }, direction, length: 2 }),
  ).toEqual(cells.map(([column, row]) => ({ column, row })))
})

it('clips circle and cone coverage at both logical map edges', () => {
  expect(cellsCoveredByTemplate({ kind: 'circle', origin: { column: 0, row: 0 }, radius: 1 })).toEqual([
    { column: 0, row: 0 },
    { column: 1, row: 0 },
    { column: 0, row: 1 },
  ])
  expect(cellsCoveredByTemplate({ kind: 'circle', origin: { column: 199, row: 199 }, radius: 1 })).toEqual([
    { column: 199, row: 198 },
    { column: 198, row: 199 },
    { column: 199, row: 199 },
  ])
  expect(
    cellsCoveredByTemplate({
      kind: 'cone',
      origin: { column: 0, row: 0 },
      direction: { column: -1, row: -1 },
      length: 2,
    }),
  ).toEqual([{ column: 0, row: 0 }])
  expect(
    cellsCoveredByTemplate({
      kind: 'cone',
      origin: { column: 199, row: 199 },
      direction: { column: 1, row: 1 },
      length: 2,
    }),
  ).toEqual([{ column: 199, row: 199 }])
})

it('orders negative and reverse lines from their origin to the clipped endpoint', () => {
  expect(
    cellsCoveredByTemplate({
      kind: 'line',
      origin: { column: 3, row: 3 },
      direction: { column: -1, row: 0 },
      length: 5,
    }),
  ).toEqual([
    { column: 3, row: 3 },
    { column: 2, row: 3 },
    { column: 1, row: 3 },
    { column: 0, row: 3 },
  ])
  expect(
    cellsCoveredByTemplate({
      kind: 'line',
      origin: { column: 3, row: 3 },
      direction: { column: -1, row: -1 },
      length: 2,
    }),
  ).toEqual([
    { column: 3, row: 3 },
    { column: 2, row: 2 },
    { column: 1, row: 1 },
  ])
})

it('rejects invalid template sizes and directions', () => {
  expect(() =>
    cellsCoveredByTemplate({ kind: 'circle', origin: { column: 10, row: 10 }, radius: 0 }),
  ).toThrow('Template size must be a positive integer')
  expect(() =>
    cellsCoveredByTemplate({
      kind: 'line',
      origin: { column: 10, row: 10 },
      direction: { column: 0, row: 0 },
      length: 2,
    }),
  ).toThrow('Direction cannot be zero')
})
