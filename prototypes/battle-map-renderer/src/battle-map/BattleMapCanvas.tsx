import { MapControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import type { MoveIntent, TokenRenderState } from './domain/tokens'
import { useBattleMapView } from './state/useBattleMapView'
import { BattleMapScene, useSceneSelection } from './scene/BattleMapScene'
import { chunkAddressKey } from './scene/MapSurface'

type BattleMapCameraProps = {
  onReady: () => void
}

const FIXTURE_TOKENS: readonly TokenRenderState[] = [
  {
    id: 'fixture-token',
    label: 'Fixture Token',
    cell: { column: 99, row: 99 },
    elevation: 0,
    color: '#37ff78',
    visible: true,
  },
]

function BattleMapCamera({ onReady }: BattleMapCameraProps) {
  const controls = useRef<MapControlsImpl>(null)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const setCamera = useBattleMapView((state) => state.setCamera)
  const dragPreview = useBattleMapView((state) => state.dragPreview)

  const syncViewState = useCallback(() => {
    const target = controls.current?.target
    const visibleCellSpan = Math.max(size.width, size.height) / camera.zoom
    setCamera(
      target ? { x: target.x, z: target.z } : { x: 100, z: 100 },
      visibleCellSpan,
    )
    invalidate()
  }, [camera, invalidate, setCamera, size.height, size.width])

  useEffect(() => {
    syncViewState()
    onReady()
  }, [onReady, syncViewState])

  return (
    <MapControls
      ref={controls}
      target={[100, 0, 100]}
      enabled={dragPreview === null}
      enableDamping={false}
      enableRotate={false}
      minZoom={4}
      maxZoom={36}
      zoomSpeed={24}
      screenSpacePanning={false}
      onChange={syncViewState}
    />
  )
}

type TokenInteractionDiagnosticsProps = {
  moveIntents: readonly MoveIntent[]
}

function TokenInteractionDiagnostics({ moveIntents }: TokenInteractionDiagnosticsProps) {
  const dragPreview = useBattleMapView((state) => state.dragPreview)
  return (
    <output
      hidden
      data-testid="token-interaction-diagnostics"
      data-drag-preview={dragPreview ? JSON.stringify(dragPreview) : ''}
      data-move-intents={JSON.stringify(moveIntents)}
    />
  )
}

type ChunkDiagnosticsProps = {
  cameraReady: boolean
}

function ChunkDiagnostics({ cameraReady }: ChunkDiagnosticsProps) {
  const { mode, visibleChunks } = useSceneSelection()
  if (!cameraReady) return null
  return (
    <output
      hidden
      data-testid="chunk-diagnostics"
      data-mode={mode}
      data-visible-chunks={visibleChunks.map(chunkAddressKey).join(',')}
    />
  )
}

export function BattleMapCanvas() {
  const [cameraReady, setCameraReady] = useState(false)
  const [moveIntents, setMoveIntents] = useState<readonly MoveIntent[]>([])
  const markCameraReady = useCallback(() => setCameraReady(true), [])
  const recordMoveIntent = useCallback(
    (intent: MoveIntent) => setMoveIntents((current) => [...current, intent]),
    [],
  )

  return (
    <div className="battle-map-shell">
      <Canvas
        data-testid="battle-map-canvas"
        orthographic
        frameloop="demand"
        camera={{ position: [100, 150, 160], rotation: [-1.19, 0, 0], zoom: 4 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        shadows="percentage"
      >
        <color attach="background" args={['#171a1f']} />
        <BattleMapCamera onReady={markCameraReady} />
        <BattleMapScene tokens={FIXTURE_TOKENS} onMoveIntent={recordMoveIntent} />
      </Canvas>
      <ChunkDiagnostics cameraReady={cameraReady} />
      <TokenInteractionDiagnostics moveIntents={moveIntents} />
    </div>
  )
}
