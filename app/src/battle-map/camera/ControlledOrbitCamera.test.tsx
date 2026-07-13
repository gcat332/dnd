import ReactThreeTestRenderer from '@react-three/test-renderer'
import { useThree } from '@react-three/fiber'
import { MathUtils, MOUSE, TOUCH } from 'three'
import type { OrthographicCamera } from 'three'
import { beforeEach, expect, it, vi } from 'vitest'
import { useBattleMapView } from '../state/useBattleMapView'
import { ControlledOrbitCamera } from './ControlledOrbitCamera'

function CameraProbe({ onCamera }: { onCamera: (camera: OrthographicCamera) => void }) {
  const camera = useThree((state) => state.camera as OrthographicCamera)
  onCamera(camera)
  return null
}

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
    mouseButtons: { LEFT: MOUSE.PAN, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE },
    touches: { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE },
  })

  await renderer.unmount()
})

it('accepts a closer initial view for focused character previews', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <ControlledOrbitCamera initialView={{ focus: { x: 100, z: 100 }, yawDegrees: 0, pitchDegrees: 55, zoom: 12 }} />,
  )

  expect(useBattleMapView.getState().cameraView).toMatchObject({
    focus: { x: 100, z: 100 },
    pitchDegrees: 55,
    zoom: 12,
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

it('applies camera presets to the camera and reports the resulting view', async () => {
  let camera: OrthographicCamera | undefined
  const onViewChange = vi.fn()
  const renderer = await ReactThreeTestRenderer.create(
    <>
      <ControlledOrbitCamera onViewChange={onViewChange} />
      <CameraProbe onCamera={(value) => { camera = value }} />
    </>,
  )

  if (!camera) throw new Error('camera probe did not run')
  const initialY = camera.position.y
  const controls = renderer.scene.findByProps({ minZoom: 4 })

  await ReactThreeTestRenderer.act(async () => {
    useBattleMapView.getState().publishCameraView({
      focus: { x: 80, z: 90 },
      yawDegrees: 125,
      pitchDegrees: 48,
      zoom: 12,
    }, 48)
    useBattleMapView.getState().requestCameraPreset('top')
  })

  expect(camera.position.x).toBeCloseTo(80, 3)
  expect(camera.position.y).toBeGreaterThan(initialY)
  expect(camera.position.z).toBeCloseTo(90, 3)
  expect(camera.zoom).toBe(12)
  expect(controls.props.object.target.x).toBeCloseTo(80)
  expect(controls.props.object.target.z).toBeCloseTo(90)
  expect(useBattleMapView.getState().cameraView).toMatchObject({
    focus: { x: 80, z: 90 },
    pitchDegrees: 90,
    zoom: 12,
  })
  expect(onViewChange).toHaveBeenCalled()

  await renderer.unmount()
})

it('does not replay an acknowledged command after remounting', async () => {
  const firstRenderer = await ReactThreeTestRenderer.create(<ControlledOrbitCamera />)

  await ReactThreeTestRenderer.act(async () => {
    useBattleMapView.getState().requestCameraPreset('top')
  })
  expect(useBattleMapView.getState().cameraCommand).toBeNull()

  useBattleMapView.getState().publishCameraView({
    focus: { x: 80, z: 90 },
    yawDegrees: 125,
    pitchDegrees: 48,
    zoom: 12,
  }, 48)
  await firstRenderer.unmount()

  const secondRenderer = await ReactThreeTestRenderer.create(<ControlledOrbitCamera />)

  expect(useBattleMapView.getState().cameraView.pitchDegrees).toBe(55)
  expect(useBattleMapView.getState().cameraView.pitchDegrees).not.toBe(90)

  await secondRenderer.unmount()
})

it('removes the context-menu listener when unmounted', async () => {
  const listeners = new Set<EventListenerOrEventListenerObject>()
  const renderer = await ReactThreeTestRenderer.create(<ControlledOrbitCamera />, {
    beforeReturn: (canvas) => {
      const originalAdd = canvas.addEventListener.bind(canvas)
      const originalRemove = canvas.removeEventListener.bind(canvas)
      canvas.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
        if (type === 'contextmenu') listeners.add(listener)
        return originalAdd(type as keyof HTMLElementEventMap, listener as EventListener, options)
      }) as typeof canvas.addEventListener
      canvas.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
        if (type === 'contextmenu') listeners.delete(listener)
        return originalRemove(type as keyof HTMLElementEventMap, listener as EventListener, options)
      }) as typeof canvas.removeEventListener
    },
  })

  expect(listeners.size).toBeGreaterThan(0)
  await renderer.unmount()
  expect(listeners.size).toBe(0)
})
