import { MapControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useRef } from 'react'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import type { TerrainFeature } from '../battle-maps/terrain'
import type { MoveIntent, TokenRenderState } from './domain/tokens'
import { BattleMapScene } from './scene/BattleMapScene'

export function BattleMapCameraControls() {
  const controls = useRef<MapControlsImpl>(null)
  return (
    <MapControls
      ref={controls}
      target={[100, 0, 100]}
      enableDamping={false}
      enableRotate={false}
      minZoom={4}
      maxZoom={36}
      zoomSpeed={24}
      screenSpacePanning={false}
    />
  )
}

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
        <BattleMapCameraControls />
        <BattleMapScene terrainFeatures={terrain} tokens={tokens} onMoveIntent={onMoveIntent} />
      </Canvas>
    </div>
  )
}
