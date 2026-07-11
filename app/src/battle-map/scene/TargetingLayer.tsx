import { BoxGeometry } from 'three'
import { cellsCoveredByTemplate, type AreaTemplate } from '../domain/effects'
import { gridToWorld } from '../domain/grid'

const TARGET_CELL_GEOMETRY = new BoxGeometry(0.92, 0.04, 0.92)

const TEMPLATE_COLORS: Record<AreaTemplate['kind'], string> = {
  circle: '#50d890',
  cone: '#ffca58',
  line: '#5bbcff',
}

export type TargetingLayerProps = {
  template: AreaTemplate | null
}

export function TargetingLayer({ template }: TargetingLayerProps) {
  const coveredCells = template ? cellsCoveredByTemplate(template) : []

  return (
    <group name="targeting-layer">
      {template
        ? coveredCells.map((cell) => {
            const point = gridToWorld(cell)
            return (
              <mesh
                key={`${cell.column}:${cell.row}`}
                name={`target-cell-${cell.column}-${cell.row}`}
                position={[point.x, 0.09, point.z]}
                userData={{ templateKind: template.kind, column: cell.column, row: cell.row }}
              >
                <primitive object={TARGET_CELL_GEOMETRY} attach="geometry" dispose={null} />
                <meshBasicMaterial
                  color={TEMPLATE_COLORS[template.kind]}
                  transparent
                  opacity={0.38}
                  depthWrite={false}
                />
              </mesh>
            )
          })
        : null}
    </group>
  )
}
