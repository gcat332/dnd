import ReactThreeTestRenderer from '@react-three/test-renderer'
import { MathUtils, MOUSE, TOUCH } from 'three'
import { beforeEach, expect, it } from 'vitest'
import { useBattleMapView } from '../state/useBattleMapView'
import { ControlledOrbitCamera } from './ControlledOrbitCamera'

beforeEach(() => {
  useBattleMapView.setState(useBattleMapView.getInitialState(), true)
})

it('configures controlled tabletop orbit interactions', async () => {
  const renderer = await ReactThreeTestRenderer.create(<ControlledOrbitCamera />)

  const controls = renderer.scene.findByProps({ minZoom: 4 })
  expect(controls.props).toMatchObject({
    enabled: true,
    enableDamping: false,
    enableRotate: true,
    minZoom: 4,
    maxZoom: 36,
    zoomSpeed: 24,
    screenSpacePanning: false,
    minPolarAngle: 0,
    maxPolarAngle: MathUtils.degToRad(55),
    mouseButtons: { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE },
    touches: { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE },
  })

  await renderer.unmount()
})

it('disables camera interactions while a token drag is in progress', async () => {
  const renderer = await ReactThreeTestRenderer.create(<ControlledOrbitCamera />)

  expect(renderer.scene.findByProps({ minZoom: 4 }).props.enabled).toBe(true)

  await ReactThreeTestRenderer.act(async () => {
    useBattleMapView.getState().previewTokenMove('fixture-token', { column: 10, row: 12 })
  })

  expect(renderer.scene.findByProps({ minZoom: 4 }).props.enabled).toBe(false)

  await renderer.unmount()
})

it('preserves logical top pitch when a north preset follows top view', async () => {
  const renderer = await ReactThreeTestRenderer.create(<ControlledOrbitCamera />)

  await ReactThreeTestRenderer.act(async () => {
    useBattleMapView.getState().requestCameraPreset('top')
  })
  expect(useBattleMapView.getState().cameraView.pitchDegrees).toBe(90)

  await ReactThreeTestRenderer.act(async () => {
    useBattleMapView.getState().requestCameraPreset('north')
  })
  expect(useBattleMapView.getState().cameraView).toMatchObject({
    yawDegrees: 0,
    pitchDegrees: 90,
  })

  await renderer.unmount()
})
