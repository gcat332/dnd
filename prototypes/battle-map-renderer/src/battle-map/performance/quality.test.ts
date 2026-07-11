import { expect, it } from 'vitest'
import { frameTimesForRollingWindow, qualityForAverageFps } from './quality'

it.each([
  [61, 'high'],
  [44, 'medium'],
  [29, 'low'],
] as const)('maps %i fps to %s quality', (fps, quality) => {
  expect(qualityForAverageFps(fps)).toBe(quality)
})

it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])('rejects invalid FPS %s', (fps) => {
  expect(() => qualityForAverageFps(fps)).toThrow(RangeError)
})

it('keeps only frame samples from the rolling five-second window', () => {
  expect(
    frameTimesForRollingWindow(
      [
        { recordedAtMs: 4_999, frameTimeMs: 20 },
        { recordedAtMs: 5_000, frameTimeMs: 18 },
        { recordedAtMs: 9_500, frameTimeMs: 16 },
      ],
      10_000,
    ),
  ).toEqual([18, 16])
})
