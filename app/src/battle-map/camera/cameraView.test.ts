import { expect, it } from 'vitest'
import {
  applyCameraPreset,
  cameraPositionForView,
  cameraViewFromPosition,
  DEFAULT_CAMERA_VIEW,
  visibleCellSpan,
} from './cameraView'

it.each([
  [-10, 350],
  [370, 10],
])('normalizes yaw %s to %s degrees', (yawDegrees, expectedYaw) => {
  const position = cameraPositionForView({ ...DEFAULT_CAMERA_VIEW, yawDegrees }, 160)
  const view = cameraViewFromPosition(position, DEFAULT_CAMERA_VIEW.focus, DEFAULT_CAMERA_VIEW.zoom)

  expect(view.yawDegrees).toBeCloseTo(expectedYaw, 8)
})

it.each([
  [20, 35],
  [100, 90],
])('clamps pitch %s to %s degrees', (pitchDegrees, expectedPitch) => {
  const position = cameraPositionForView({ ...DEFAULT_CAMERA_VIEW, pitchDegrees }, 160)
  const view = cameraViewFromPosition(position, DEFAULT_CAMERA_VIEW.focus, DEFAULT_CAMERA_VIEW.zoom)

  expect(view.pitchDegrees).toBeCloseTo(expectedPitch, 8)
})

it('round-trips the default 55-degree camera view', () => {
  const position = cameraPositionForView(DEFAULT_CAMERA_VIEW, 160)
  const view = cameraViewFromPosition(position, DEFAULT_CAMERA_VIEW.focus, DEFAULT_CAMERA_VIEW.zoom)

  expect(view.focus).toEqual(DEFAULT_CAMERA_VIEW.focus)
  expect(view.yawDegrees).toBeCloseTo(DEFAULT_CAMERA_VIEW.yawDegrees, 3)
  expect(view.pitchDegrees).toBeCloseTo(DEFAULT_CAMERA_VIEW.pitchDegrees, 3)
  expect(view.zoom).toBe(DEFAULT_CAMERA_VIEW.zoom)
})

it('applies the exact camera presets', () => {
  const custom = { focus: { x: 40, z: 60 }, yawDegrees: 125, pitchDegrees: 48, zoom: 12 }

  expect(applyCameraPreset(custom, 'north')).toEqual({ ...custom, yawDegrees: 0 })
  expect(applyCameraPreset(custom, 'top')).toEqual({ ...custom, pitchDegrees: 90 })
  expect(applyCameraPreset(custom, 'reset')).toEqual(DEFAULT_CAMERA_VIEW)
})

it('derives the visible cell span from viewport size and zoom', () => {
  expect(visibleCellSpan({ width: 1280, height: 800 }, 10)).toBe(128)
})

it('rejects invalid camera math inputs', () => {
  expect(() => cameraPositionForView(DEFAULT_CAMERA_VIEW, 0)).toThrow(RangeError)
  expect(() => cameraPositionForView({ ...DEFAULT_CAMERA_VIEW, yawDegrees: Number.NaN }, 160)).toThrow(
    RangeError,
  )
  expect(() =>
    cameraViewFromPosition([Number.POSITIVE_INFINITY, 10, 10], DEFAULT_CAMERA_VIEW.focus, 4),
  ).toThrow(RangeError)
  expect(() => cameraViewFromPosition([100, 100, 100], DEFAULT_CAMERA_VIEW.focus, 0)).toThrow(
    RangeError,
  )
  expect(() => visibleCellSpan({ width: 0, height: 800 }, 10)).toThrow(RangeError)
  expect(() => visibleCellSpan({ width: 1280, height: 800 }, Number.NaN)).toThrow(RangeError)
})
