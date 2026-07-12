import { MathUtils } from 'three'
import type { WorldPoint } from '../domain/grid'

export type CameraView = Readonly<{
  focus: WorldPoint
  yawDegrees: number
  pitchDegrees: number
  zoom: number
}>

export type CameraPreset = 'north' | 'top' | 'reset'

export const MIN_CAMERA_PITCH = 35
export const MAX_CAMERA_PITCH = 90

export const DEFAULT_CAMERA_VIEW: CameraView = {
  focus: { x: 100, z: 100 },
  yawDegrees: 0,
  pitchDegrees: 55,
  zoom: 4,
}

type CameraPosition = readonly [x: number, y: number, z: number]
type ViewportSize = Readonly<{ width: number; height: number }>

function requireFinite(...values: number[]): void {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError('Camera values must be finite')
  }
}

function requirePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and positive`)
  }
}

function normalizedYaw(yawDegrees: number): number {
  return ((yawDegrees % 360) + 360) % 360
}

function clampedPitch(pitchDegrees: number): number {
  return MathUtils.clamp(pitchDegrees, MIN_CAMERA_PITCH, MAX_CAMERA_PITCH)
}

export function cameraPositionForView(view: CameraView, distance: number): CameraPosition {
  requireFinite(view.focus.x, view.focus.z, view.yawDegrees, view.pitchDegrees)
  requirePositive(view.zoom, 'Camera zoom')
  requirePositive(distance, 'Camera distance')

  const yawDegrees = normalizedYaw(view.yawDegrees)
  const pitchDegrees = clampedPitch(view.pitchDegrees)
  const horizontal = distance * Math.cos(MathUtils.degToRad(pitchDegrees))

  return [
    view.focus.x + horizontal * Math.sin(MathUtils.degToRad(yawDegrees)),
    distance * Math.sin(MathUtils.degToRad(pitchDegrees)),
    view.focus.z + horizontal * Math.cos(MathUtils.degToRad(yawDegrees)),
  ]
}

export function cameraViewFromPosition(
  position: CameraPosition,
  focus: WorldPoint,
  zoom: number,
): CameraView {
  requireFinite(...position, focus.x, focus.z)
  requirePositive(zoom, 'Camera zoom')

  const offsetX = position[0] - focus.x
  const offsetY = position[1]
  const offsetZ = position[2] - focus.z
  const distance = Math.hypot(offsetX, offsetY, offsetZ)
  requirePositive(distance, 'Camera distance')

  return {
    focus,
    yawDegrees: normalizedYaw(MathUtils.radToDeg(Math.atan2(offsetX, offsetZ))),
    pitchDegrees: clampedPitch(MathUtils.radToDeg(Math.asin(offsetY / distance))),
    zoom,
  }
}

export function applyCameraPreset(view: CameraView, preset: CameraPreset): CameraView {
  if (preset === 'north') return { ...view, yawDegrees: 0 }
  if (preset === 'top') return { ...view, pitchDegrees: 90 }
  return DEFAULT_CAMERA_VIEW
}

export function visibleCellSpan(viewport: ViewportSize, zoom: number): number {
  requirePositive(viewport.width, 'Viewport width')
  requirePositive(viewport.height, 'Viewport height')
  requirePositive(zoom, 'Camera zoom')
  return Math.max(viewport.width, viewport.height) / zoom
}
