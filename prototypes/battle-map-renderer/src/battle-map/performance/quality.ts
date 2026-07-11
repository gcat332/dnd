export type SceneQuality = 'high' | 'medium' | 'low'

export type SceneQualitySettings = Readonly<{
  maxDpr: number
  shadowMapSize: 2048 | 1024 | 512
  softShadows: boolean
  particleScale: 1 | 0.5 | 0.25
  postProcessing: boolean
}>

export type FrameTimeSample = Readonly<{
  recordedAtMs: number
  frameTimeMs: number
}>

export function frameTimesForRollingWindow(
  samples: readonly FrameTimeSample[],
  nowMs: number,
  windowMs = 5_000,
): number[] {
  const earliestMs = nowMs - windowMs
  return samples
    .filter((sample) => sample.recordedAtMs >= earliestMs)
    .map((sample) => sample.frameTimeMs)
}

export function qualityForAverageFps(averageFps: number): SceneQuality {
  if (!Number.isFinite(averageFps) || averageFps < 0) {
    throw new RangeError('FPS must be non-negative')
  }
  if (averageFps >= 55) return 'high'
  if (averageFps >= 30) return 'medium'
  return 'low'
}

export const QUALITY_SETTINGS: Readonly<Record<SceneQuality, SceneQualitySettings>> = {
  high: {
    maxDpr: 2,
    shadowMapSize: 2048,
    softShadows: true,
    particleScale: 1,
    postProcessing: true,
  },
  medium: {
    maxDpr: 1.5,
    shadowMapSize: 1024,
    softShadows: true,
    particleScale: 0.5,
    postProcessing: true,
  },
  low: {
    maxDpr: 1,
    shadowMapSize: 512,
    softShadows: false,
    particleScale: 0.25,
    postProcessing: false,
  },
}
