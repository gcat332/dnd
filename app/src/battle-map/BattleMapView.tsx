import { Canvas } from '@react-three/fiber'
import type { TerrainFeature } from '../battle-maps/terrain'
import { CameraToolbar } from './camera/CameraToolbar'
import { ControlledOrbitCamera } from './camera/ControlledOrbitCamera'
import { BattleMapScene } from './scene/BattleMapScene'

type BattleMapViewProps = {
  terrain?: readonly TerrainFeature[]
}

export function BattleMapView({ terrain = [] }: BattleMapViewProps = {}) {
  return (
    <div className="battle-map-view">
      <Canvas
        orthographic
        frameloop="demand"
        camera={{ position: [100, 150, 160], rotation: [-1.19, 0, 0], zoom: 4 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#171a1f']} />
        <ControlledOrbitCamera />
        <BattleMapScene terrainFeatures={terrain} />
      </Canvas>
      <CameraToolbar />
    </div>
  )
}
