import { MapControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'
import { MathUtils, MOUSE, OrthographicCamera, TOUCH, Vector3 } from 'three'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import { useBattleMapView } from '../state/useBattleMapView'
import {
  applyCameraPreset,
  cameraPositionForView,
  cameraViewFromPosition,
  DEFAULT_CAMERA_VIEW,
  type CameraView,
  visibleCellSpan,
} from './cameraView'

type ControlledOrbitCameraProps = {
  enabled?: boolean
  onReady?: () => void
  onViewChange?: (view: CameraView) => void
}

const TOP_VIEW_HORIZONTAL_OFFSET = 0.0001

export function ControlledOrbitCamera({
  enabled = true,
  onReady,
  onViewChange,
}: ControlledOrbitCameraProps) {
  const controls = useRef<MapControlsImpl>(null)
  const initialized = useRef(false)
  const lastCameraCommandSequence = useRef<number | null>(null)
  const camera = useThree((state) => state.camera as OrthographicCamera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const canvas = useThree((state) => state.gl.domElement)
  const cameraCommand = useBattleMapView((state) => state.cameraCommand)
  const cameraView = useBattleMapView((state) => state.cameraView)
  const dragPreview = useBattleMapView((state) => state.dragPreview)
  const publishCameraView = useBattleMapView((state) => state.publishCameraView)

  const publishView = useCallback((logicalView?: CameraView) => {
    const target = controls.current?.target
    if (!target) return
    const view = logicalView ?? cameraViewFromPosition(
      [camera.position.x, camera.position.y, camera.position.z],
      { x: target.x, z: target.z },
      camera.zoom,
    )
    publishCameraView(view, visibleCellSpan(size, camera.zoom))
    onViewChange?.(view)
    invalidate()
  }, [camera, invalidate, onViewChange, publishCameraView, size.height, size.width])

  const positionForView = useCallback((view: CameraView, distance: number) => {
    if (view.pitchDegrees !== 90) return cameraPositionForView(view, distance)

    const yaw = MathUtils.degToRad(view.yawDegrees)
    const verticalDistance = Math.sqrt(
      Math.max(0, distance ** 2 - TOP_VIEW_HORIZONTAL_OFFSET ** 2),
    )
    return [
      view.focus.x + TOP_VIEW_HORIZONTAL_OFFSET * Math.sin(yaw),
      verticalDistance,
      view.focus.z + TOP_VIEW_HORIZONTAL_OFFSET * Math.cos(yaw),
    ] as const
  }, [])

  const applyView = useCallback((view: CameraView) => {
    const activeControls = controls.current
    if (!activeControls) return
    const distance = camera.position.distanceTo(activeControls.target)
    activeControls.target.set(view.focus.x, 0, view.focus.z)
    camera.position.fromArray(positionForView(view, distance))
    camera.zoom = view.zoom
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    activeControls.update()
    publishView(view)
  }, [camera, positionForView, publishView])

  useEffect(() => {
    const activeControls = controls.current
    if (!activeControls || initialized.current) return
    initialized.current = true
    activeControls.target.set(DEFAULT_CAMERA_VIEW.focus.x, 0, DEFAULT_CAMERA_VIEW.focus.z)
    const initialDistance = camera.position.distanceTo(activeControls.target)
    camera.position.fromArray(cameraPositionForView(DEFAULT_CAMERA_VIEW, initialDistance))
    camera.zoom = DEFAULT_CAMERA_VIEW.zoom
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    activeControls.update()
    publishView(DEFAULT_CAMERA_VIEW)
    onReady?.()
  }, [camera, onReady, publishView])

  useEffect(() => {
    if (
      !cameraCommand ||
      !controls.current ||
      lastCameraCommandSequence.current === cameraCommand.sequence
    ) return
    lastCameraCommandSequence.current = cameraCommand.sequence
    applyView(applyCameraPreset(cameraView, cameraCommand.preset))
  }, [applyView, cameraCommand?.sequence, cameraView])

  useEffect(() => {
    const preventContextMenu = (event: MouseEvent) => event.preventDefault()
    canvas.addEventListener('contextmenu', preventContextMenu)
    return () => canvas.removeEventListener('contextmenu', preventContextMenu)
  }, [canvas])

  return (
    <MapControls
      ref={controls}
      target={[DEFAULT_CAMERA_VIEW.focus.x, 0, DEFAULT_CAMERA_VIEW.focus.z]}
      enabled={enabled && dragPreview === null}
      enableDamping={false}
      enableRotate
      minZoom={4}
      maxZoom={36}
      zoomSpeed={24}
      screenSpacePanning={false}
      minPolarAngle={0}
      maxPolarAngle={MathUtils.degToRad(55)}
      mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
      touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE }}
      onChange={() => publishView()}
    />
  )
}
