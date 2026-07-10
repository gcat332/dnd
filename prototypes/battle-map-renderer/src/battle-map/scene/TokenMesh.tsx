import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import { CylinderGeometry, Plane, Vector3 } from 'three'
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

export function TokenMesh({ token, onMoveIntent }: TokenMeshProps) {
  const invalidate = useThree((state) => state.invalidate)
  const selected = useBattleMapView((state) => state.selectedTokenId === token.id)
  const dragPreview = useBattleMapView((state) =>
    state.dragPreview?.tokenId === token.id ? state.dragPreview : null,
  )
  const selectToken = useBattleMapView((state) => state.selectToken)
  const previewTokenMove = useBattleMapView((state) => state.previewTokenMove)
  const clearDragPreview = useBattleMapView((state) => state.clearDragPreview)
  const dragPointer = useRef<number | null>(null)
  const displayCell = dragPreview?.cell ?? token.cell
  const point = gridToWorld(displayCell)

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    stopMapInteraction(event)
    dragPointer.current = event.pointerId
    selectToken(token.id)
    pointerCaptureTarget(event).setPointerCapture(event.pointerId)
    invalidate()
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (dragPointer.current !== event.pointerId) return
    stopMapInteraction(event)
    const cell = cellUnderPointer(event)
    if (!cell) return
    previewTokenMove(token.id, cell)
    invalidate()
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (dragPointer.current !== event.pointerId) return
    stopMapInteraction(event)
    const preview = useBattleMapView.getState().dragPreview
    const to = preview?.tokenId === token.id ? preview.cell : token.cell
    dragPointer.current = null
    pointerCaptureTarget(event).releasePointerCapture(event.pointerId)
    onMoveIntent({
      tokenId: token.id,
      from: token.cell,
      to,
      path: straightGridPath(token.cell, to),
    })
    clearDragPreview()
    invalidate()
  }

  const handlePointerCancel = (event: ThreeEvent<PointerEvent>) => {
    if (dragPointer.current !== event.pointerId) return
    stopMapInteraction(event)
    dragPointer.current = null
    clearDragPreview()
    invalidate()
  }

  return (
    <mesh
      name={`token-${token.id}`}
      position={[point.x, token.elevation + TOKEN_HEIGHT / 2, point.z]}
      scale={selected ? 1.12 : 1}
      castShadow
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      userData={{ tokenId: token.id, label: token.label }}
    >
      <primitive object={TOKEN_GEOMETRY} attach="geometry" />
      <meshStandardMaterial
        color={token.color}
        roughness={0.52}
        emissive={selected ? token.color : '#000000'}
        emissiveIntensity={selected ? 0.18 : 0}
      />
    </mesh>
  )
}
