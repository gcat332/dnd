import { Html } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'
import { CylinderGeometry, Plane, Vector2, Vector3 } from 'three'
import { gridToWorld, worldToGrid } from '../domain/grid'
import { straightGridPath } from '../domain/movement'
import type { MoveIntent, TokenRenderState } from '../domain/tokens'
import { useBattleMapView } from '../state/useBattleMapView'

const TOKEN_HEIGHT = 0.5
const TOKEN_GEOMETRY = new CylinderGeometry(0.42, 0.42, TOKEN_HEIGHT, 32)
const DRAG_PLANE = new Plane(new Vector3(0, 1, 0), 0)
const DRAG_POINT = new Vector3()

type TokenMeshProps = {
  token: TokenRenderState
  onMoveIntent: (intent: MoveIntent) => void
  interactiveOnly?: boolean
}

type ActivePointer = {
  pointerId: number
  target: HTMLElement
}

function stopMapInteraction(event: ThreeEvent<PointerEvent>): void {
  event.stopPropagation()
  event.nativeEvent.stopImmediatePropagation()
}

function pointerCaptureTarget(event: ThreeEvent<PointerEvent>): HTMLElement {
  return event.target as HTMLElement
}

function cellUnderPointer(event: ThreeEvent<PointerEvent>) {
  const point = event.ray.intersectPlane(DRAG_PLANE, DRAG_POINT)
  if (!point) return null
  try {
    return worldToGrid({ x: point.x, z: point.z })
  } catch (error) {
    if (error instanceof RangeError) return null
    throw error
  }
}

export function TokenMesh({ token, onMoveIntent, interactiveOnly = false }: TokenMeshProps) {
  const invalidate = useThree((state) => state.invalidate)
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const raycaster = useThree((state) => state.raycaster)
  const selected = useBattleMapView((state) => state.selectedTokenId === token.id)
  const dragPreview = useBattleMapView((state) =>
    state.dragPreview?.tokenId === token.id ? state.dragPreview : null,
  )
  const selectToken = useBattleMapView((state) => state.selectToken)
  const previewTokenMove = useBattleMapView((state) => state.previewTokenMove)
  const clearDragPreview = useBattleMapView((state) => state.clearDragPreview)
  const activePointer = useRef<ActivePointer | null>(null)
  const displayCell = dragPreview?.cell ?? token.cell
  const point = gridToWorld(displayCell)

  const cellAtClientPoint = useCallback((clientX: number, clientY: number) => {
    const bounds = gl.domElement.getBoundingClientRect()
    const pointer = new Vector2(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    const intersection = raycaster.ray.intersectPlane(DRAG_PLANE, DRAG_POINT)
    if (!intersection) return null
    try {
      return worldToGrid({ x: intersection.x, z: intersection.z })
    } catch (error) {
      if (error instanceof RangeError) return null
      throw error
    }
  }, [camera, gl, raycaster])

  const finishPointer = useCallback((pointerId: number) => {
    const active = activePointer.current
    if (active?.pointerId !== pointerId) return
    const preview = useBattleMapView.getState().dragPreview
    const to = preview?.tokenId === token.id ? preview.cell : null
    activePointer.current = null
    try {
      active.target.releasePointerCapture(pointerId)
    } catch {
      // WebKit may release capture before its canvas-level pointerup fallback.
    }
    if (to && (to.column !== token.cell.column || to.row !== token.cell.row)) {
      onMoveIntent({
        tokenId: token.id,
        from: token.cell,
        to,
        path: straightGridPath(token.cell, to),
      })
    }
    clearDragPreview()
    invalidate()
  }, [clearDragPreview, invalidate, onMoveIntent, token.cell, token.id])

  useEffect(() => {
    const canvas = gl.domElement
    const handleMove = (event: PointerEvent) => {
      if (activePointer.current?.pointerId !== event.pointerId) return
      const cell = cellAtClientPoint(event.clientX, event.clientY)
      if (!cell) return
      previewTokenMove(token.id, cell)
      invalidate()
    }
    const handleUp = (event: PointerEvent) => finishPointer(event.pointerId)
    const handleCancel = (event: PointerEvent) => {
      if (activePointer.current?.pointerId !== event.pointerId) return
      activePointer.current = null
      clearDragPreview()
      invalidate()
    }
    canvas.addEventListener('pointermove', handleMove)
    canvas.addEventListener('pointerup', handleUp)
    canvas.addEventListener('pointercancel', handleCancel)
    return () => {
      canvas.removeEventListener('pointermove', handleMove)
      canvas.removeEventListener('pointerup', handleUp)
      canvas.removeEventListener('pointercancel', handleCancel)
    }
  }, [cellAtClientPoint, clearDragPreview, finishPointer, gl, invalidate, previewTokenMove, token.id])

  useEffect(
    () => () => {
      const active = activePointer.current
      activePointer.current = null
      if (active) {
        try {
          active.target.releasePointerCapture(active.pointerId)
        } catch {
          // Pointer capture may already have been released by the browser.
        }
      }
      const preview = useBattleMapView.getState().dragPreview
      if (preview?.tokenId === token.id) useBattleMapView.getState().clearDragPreview()
      invalidate()
    },
    [invalidate, token.id],
  )

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== undefined && event.button !== 0) return
    stopMapInteraction(event)
    selectToken(token.id)
    const target = pointerCaptureTarget(event)
    target.setPointerCapture(event.pointerId)
    activePointer.current = { pointerId: event.pointerId, target }
    invalidate()
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (activePointer.current?.pointerId !== event.pointerId) return
    stopMapInteraction(event)
    const cell = cellUnderPointer(event)
    if (!cell) return
    previewTokenMove(token.id, cell)
    invalidate()
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (activePointer.current?.pointerId !== event.pointerId) return
    stopMapInteraction(event)
    finishPointer(event.pointerId)
  }

  const handlePointerCancel = (event: ThreeEvent<PointerEvent>) => {
    if (activePointer.current?.pointerId !== event.pointerId) return
    stopMapInteraction(event)
    activePointer.current = null
    clearDragPreview()
    invalidate()
  }

  return (
    <mesh
      name={`token-${token.id}`}
      position={[point.x, token.elevation + TOKEN_HEIGHT / 2, point.z]}
      scale={selected ? 1.12 : 1}
      castShadow={!interactiveOnly}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
      userData={{ tokenId: token.id, label: token.label }}
    >
      <primitive object={TOKEN_GEOMETRY} attach="geometry" dispose={null} />
      <meshStandardMaterial
        color={token.color}
        roughness={0.52}
        transparent={interactiveOnly}
        opacity={interactiveOnly ? 0 : 1}
        emissive={selected ? token.color : '#000000'}
        emissiveIntensity={selected ? 0.18 : 0}
      />
      {selected && !interactiveOnly ? (
        <Html
          center
          position={[0, TOKEN_HEIGHT / 2 + 0.3, 0]}
          style={{ pointerEvents: 'none' }}
          className="token-label"
        >
          {token.label}
        </Html>
      ) : null}
    </mesh>
  )
}
