import { expect, it } from 'vitest'
import {
  frameTimesForRollingWindow,
  nextQualityTransition,
  qualityForAverageFps,
} from './quality'

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

it('changes quality only after two consecutive matching windows', () => {
  const first = nextQualityTransition('high', { candidate: null, consecutiveWindows: 0 }, 'low')
  expect(first).toEqual({ quality: 'high', candidate: 'low', consecutiveWindows: 1 })
  expect(nextQualityTransition('high', first, 'low')).toEqual({
    quality: 'low',
    candidate: null,
    consecutiveWindows: 0,
  })
})

it('resets the transition when the candidate changes and avoids oscillation at current quality', () => {
  const lowWindow = nextQualityTransition('high', { candidate: null, consecutiveWindows: 0 }, 'low')
  const reset = nextQualityTransition('high', lowWindow, 'medium')
  expect(reset).toEqual({ quality: 'high', candidate: 'medium', consecutiveWindows: 1 })
  expect(nextQualityTransition('high', reset, 'high')).toEqual({
    quality: 'high',
    candidate: null,
    consecutiveWindows: 0,
  })
})
