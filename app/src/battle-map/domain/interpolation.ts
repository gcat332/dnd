import type { WorldPoint } from './grid'

export function interpolateWorldPoint(
  from: WorldPoint,
  to: WorldPoint,
  nowMs: number,
  eventStartMs: number,
  durationMs: number,
): WorldPoint {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new RangeError('Animation duration must be positive')
  }
  const progress = Math.min(1, Math.max(0, (nowMs - eventStartMs) / durationMs))
  return {
    x: from.x + (to.x - from.x) * progress,
    z: from.z + (to.z - from.z) * progress,
  }
}
