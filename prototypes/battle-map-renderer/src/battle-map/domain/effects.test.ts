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
