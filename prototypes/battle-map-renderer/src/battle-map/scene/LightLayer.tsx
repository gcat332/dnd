import type { GridCell } from '../domain/grid'
import { gridToWorld } from '../domain/grid'

export type VisualLight = Readonly<{
  id: string
  cell: GridCell
  elevation: number
  color: string
  intensity: number
  range: number
}>

export type LightLayerProps = {
  lights: readonly VisualLight[]
}

export function LightLayer({ lights }: LightLayerProps) {
  return (
    <group name="light-layer">
      {lights.map((light) => {
        const point = gridToWorld(light.cell)
        return (
          <pointLight
            key={light.id}
            name={`visual-light-${light.id}`}
            position={[point.x, light.elevation, point.z]}
            color={light.color}
            intensity={light.intensity}
            distance={light.range}
            decay={2}
            castShadow
          />
        )
      })}
    </group>
  )
}
