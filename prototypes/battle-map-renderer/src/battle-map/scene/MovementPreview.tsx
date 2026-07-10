import { BoxGeometry, MeshBasicMaterial } from 'three'
import { gridToWorld, type GridCell } from '../domain/grid'
import { straightGridPath } from '../domain/movement'

const PREVIEW_GEOMETRY = new BoxGeometry(1, 1, 1)
const PREVIEW_MATERIAL = new MeshBasicMaterial({
  color: '#ffe07a',
  depthWrite: false,
  opacity: 0.72,
  transparent: true,
})

type MovementPreviewProps = {
  from: GridCell
  to: GridCell
}

export function MovementPreview({ from, to }: MovementPreviewProps) {
  const path = straightGridPath(from, to)

  return (
    <group name="movement-preview" dispose={null}>
      {path.map((cell) => {
        const point = gridToWorld(cell)
        return (
          <mesh
            key={`${cell.column}:${cell.row}`}
            name={`movement-preview-cell-${cell.column}-${cell.row}`}
            position={[point.x, 0.075, point.z]}
            scale={[0.24, 0.05, 0.24]}
            renderOrder={3}
          >
            <primitive object={PREVIEW_GEOMETRY} attach="geometry" />
            <primitive object={PREVIEW_MATERIAL} attach="material" />
          </mesh>
        )
      })}
    </group>
  )
}
