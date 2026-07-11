export type SceneQuality = 'high' | 'medium' | 'low'

export type SceneQualitySettings = Readonly<{
  maxDpr: number
  shadowMapSize: 2048 | 1024 | 512
  softShadows: boolean
  particleScale: 1 | 0.5 | 0.25
  outputProcessing: boolean
}>

export type QualityTransition = Readonly<{
  quality: SceneQuality
  candidate: SceneQuality | null
  consecutiveWindows: number
}>

export function nextQualityTransition(
  currentQuality: SceneQuality,
  current: Pick<QualityTransition, 'candidate' | 'consecutiveWindows'>,
  candidate: SceneQuality,
): QualityTransition {
  if (candidate === currentQuality) {
    return { quality: currentQuality, candidate: null, consecutiveWindows: 0 }
  }
  if (candidate !== current.candidate) {
    return { quality: currentQuality, candidate, consecutiveWindows: 1 }
  }
  if (current.consecutiveWindows >= 1) {
    return { quality: candidate, candidate: null, consecutiveWindows: 0 }
  }
  return { quality: currentQuality, candidate, consecutiveWindows: 1 }
}

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
    outputProcessing: true,
  },
  medium: {
    maxDpr: 1.5,
    shadowMapSize: 1024,
    softShadows: true,
    particleScale: 0.5,
    outputProcessing: true,
  },
  low: {
    maxDpr: 1,
    shadowMapSize: 512,
    softShadows: false,
    particleScale: 0.25,
    outputProcessing: false,
  },
}
