import { expect, it } from 'vitest'
import { interpolateWorldPoint } from './interpolation'

it('resumes animation from the event timestamp instead of restarting', () => {
  expect(interpolateWorldPoint({ x: 0, z: 0 }, { x: 10, z: 0 }, 1_500, 1_000, 1_000)).toEqual({
    x: 5,
    z: 0,
  })
})

it('clamps animation before its start and after its endpoint', () => {
  expect(interpolateWorldPoint({ x: 2, z: 4 }, { x: 8, z: 10 }, 500, 1_000, 1_000)).toEqual({
    x: 2,
    z: 4,
  })
  expect(interpolateWorldPoint({ x: 2, z: 4 }, { x: 8, z: 10 }, 2_500, 1_000, 1_000)).toEqual({
    x: 8,
    z: 10,
  })
})

it('rejects non-positive and non-finite durations', () => {
  expect(() => interpolateWorldPoint({ x: 0, z: 0 }, { x: 1, z: 1 }, 0, 0, 0)).toThrow(
    'Animation duration must be positive',
  )
  expect(() =>
    interpolateWorldPoint({ x: 0, z: 0 }, { x: 1, z: 1 }, 0, 0, Number.POSITIVE_INFINITY),
  ).toThrow('Animation duration must be positive')
})
