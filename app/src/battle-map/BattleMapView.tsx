import { Canvas } from '@react-three/fiber'
import type { TerrainFeature } from '../battle-maps/terrain'
import { CameraToolbar } from './camera/CameraToolbar'
import { ControlledOrbitCamera } from './camera/ControlledOrbitCamera'
import type { MoveIntent, TokenRenderState } from './domain/tokens'
import { BattleMapScene } from './scene/BattleMapScene'

type BattleMapViewProps = {
  terrain?: readonly TerrainFeature[]
  tokens?: readonly TokenRenderState[]
  onMoveIntent?: (intent: MoveIntent) => void
}

export function BattleMapView({ terrain = [], tokens = [], onMoveIntent }: BattleMapViewProps = {}) {
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
        <BattleMapScene terrainFeatures={terrain} tokens={tokens} onMoveIntent={onMoveIntent} />
      </Canvas>
      <CameraToolbar />
    </div>
  )
}
