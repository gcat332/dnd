import { beforeEach, expect, it } from 'vitest'
import type { CameraView } from '../camera/cameraView'
import { useBattleMapView } from './useBattleMapView'

beforeEach(() => {
  useBattleMapView.setState(useBattleMapView.getInitialState(), true)
})

it('preserves local interaction state when the camera changes', () => {
  const cameraView: CameraView = {
    focus: { x: 80, z: 90 },
    yawDegrees: 125,
    pitchDegrees: 48,
    zoom: 12,
  }
  useBattleMapView.getState().selectToken('token-1')
  useBattleMapView.getState().previewTokenMove('token-1', { column: 12, row: 34 })

  useBattleMapView.getState().publishCameraView(cameraView, 48)

  expect(useBattleMapView.getState().cameraView).toEqual(cameraView)
  expect(useBattleMapView.getState().visibleCellSpan).toBe(48)
  expect(useBattleMapView.getState().selectedTokenId).toBe('token-1')
  expect(useBattleMapView.getState().dragPreview).toEqual({
    tokenId: 'token-1',
    cell: { column: 12, row: 34 },
  })
})

it('publishes a new command for repeated camera preset requests', () => {
  useBattleMapView.getState().requestCameraPreset('north')
  const firstCommand = useBattleMapView.getState().cameraCommand

  useBattleMapView.getState().requestCameraPreset('north')
  const secondCommand = useBattleMapView.getState().cameraCommand

  expect(firstCommand?.preset).toBe('north')
  expect(secondCommand?.preset).toBe('north')
  expect(secondCommand?.sequence).not.toBe(firstCommand?.sequence)
})

it('acknowledges a command without reusing its sequence', () => {
  useBattleMapView.getState().requestCameraPreset('north')
  const firstSequence = useBattleMapView.getState().cameraCommand?.sequence
  if (firstSequence === undefined) throw new Error('expected a camera command')

  useBattleMapView.getState().acknowledgeCameraCommand(firstSequence)
  expect(useBattleMapView.getState().cameraCommand).toBeNull()

  useBattleMapView.getState().requestCameraPreset('top')
  expect(useBattleMapView.getState().cameraCommand?.sequence).toBeGreaterThan(firstSequence)
})
