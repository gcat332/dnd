import { MapControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import { MAP_SIZE_CELLS, type GridCell } from './domain/grid'
import type { MoveIntent, TokenRenderState } from './domain/tokens'
import {
  visibilityTextureData,
  type CellVisibility,
  type VisibilityGrid,
} from './domain/visibility'
import { useBattleMapView } from './state/useBattleMapView'
import { BattleMapScene, useSceneSelection } from './scene/BattleMapScene'
import type { VisualLight } from './scene/LightLayer'
import { chunkAddressKey } from './scene/MapSurface'

type BattleMapCameraProps = {
  onReady: () => void
  onVisibilityProbePoints: (points: VisibilityProbePoints) => void
}

type ScreenPoint = Readonly<{ x: number; y: number }>
type VisibilityProbePoints = Readonly<{
  visible: ScreenPoint
  explored: ScreenPoint
  hidden: ScreenPoint
}>

const VISIBILITY_PROBE_CELLS = {
  visible: { column: 97, row: 99 },
  explored: { column: 105, row: 99 },
  hidden: { column: 110, row: 99 },
} as const

const FIXTURE_TOKENS: readonly TokenRenderState[] = [
  {
    id: 'fixture-token',
    label: 'Fixture Token',
    cell: { column: 99, row: 99 },
    elevation: 0,
    color: '#37ff78',
    visible: true,
  },
  {
    id: 'hidden-token',
    label: 'Hidden Token',
    cell: { column: 112, row: 100 },
    elevation: 0,
    color: '#ff4f81',
    visible: true,
  },
]

const PLAYER_TOKENS = FIXTURE_TOKENS.filter((token) => token.id !== 'hidden-token')

const DM_VISIBILITY: VisibilityGrid = {
  width: MAP_SIZE_CELLS,
  height: MAP_SIZE_CELLS,
  cells: Array.from({ length: MAP_SIZE_CELLS * MAP_SIZE_CELLS }, () => 'visible'),
}

function playerVisibility(): VisibilityGrid {
  const cells: CellVisibility[] = []
  for (let row = 0; row < MAP_SIZE_CELLS; row += 1) {
    for (let column = 0; column < MAP_SIZE_CELLS; column += 1) {
      const distance = Math.hypot(column - 99, row - 99)
      cells.push(distance <= 4 ? 'visible' : distance <= 8 ? 'explored' : 'hidden')
    }
  }
  return { width: MAP_SIZE_CELLS, height: MAP_SIZE_CELLS, cells }
}

const PLAYER_VISIBILITY = playerVisibility()

const FIXED_LIGHTS: readonly VisualLight[] = [
  {
    id: 'door-sconce',
    cell: { column: 99, row: 93 },
    elevation: 3,
    color: '#ff9f43',
    intensity: 18,
    range: 14,
  },
]

function visibilityChecksum(grid: VisibilityGrid): string {
  let checksum = 0x811c9dc5
  for (const byte of visibilityTextureData(grid)) {
    checksum ^= byte
    checksum = Math.imul(checksum, 0x01000193)
  }
  return (checksum >>> 0).toString(16).padStart(8, '0')
}

type Viewer = 'dm' | 'player'

function fixtureViewer(): Viewer {
  return new URLSearchParams(window.location.search).get('viewer') === 'player' ? 'player' : 'dm'
}

function BattleMapCamera({ onReady, onVisibilityProbePoints }: BattleMapCameraProps) {
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
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    const projectCell = (cell: GridCell): ScreenPoint => {
      const point = new Vector3(cell.column + 0.5, 0.06, cell.row + 0.5).project(camera)
      return {
        x: ((point.x + 1) / 2) * size.width,
        y: ((1 - point.y) / 2) * size.height,
      }
    }
    onVisibilityProbePoints({
      visible: projectCell(VISIBILITY_PROBE_CELLS.visible),
      explored: projectCell(VISIBILITY_PROBE_CELLS.explored),
      hidden: projectCell(VISIBILITY_PROBE_CELLS.hidden),
    })
    invalidate()
  }, [camera, invalidate, onVisibilityProbePoints, setCamera, size.height, size.width])

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

type VisibilityDiagnosticsProps = {
  viewer: Viewer
  tokens: readonly TokenRenderState[]
  visibility: VisibilityGrid
  movingLightCell: GridCell
  probePoints: VisibilityProbePoints | null
}

function VisibilityDiagnostics({
  viewer,
  tokens,
  visibility,
  movingLightCell,
  probePoints,
}: VisibilityDiagnosticsProps) {
  return (
    <output
      hidden
      data-testid="visibility-diagnostics"
      data-viewer={viewer}
      data-visible-token-ids={tokens.filter((token) => token.visible).map((token) => token.id).join(',')}
      data-visibility-checksum={visibilityChecksum(visibility)}
      data-moving-light-cell={`${movingLightCell.column}:${movingLightCell.row}`}
      data-visibility-probe-points={probePoints ? JSON.stringify(probePoints) : ''}
    />
  )
}

export function BattleMapCanvas() {
  const [viewer] = useState<Viewer>(fixtureViewer)
  const [cameraReady, setCameraReady] = useState(false)
  const [moveIntents, setMoveIntents] = useState<readonly MoveIntent[]>([])
  const [movingLightCell, setMovingLightCell] = useState<GridCell>({ column: 101, row: 100 })
  const [probePoints, setProbePoints] = useState<VisibilityProbePoints | null>(null)
  const markCameraReady = useCallback(() => setCameraReady(true), [])
  const recordVisibilityProbePoints = useCallback(
    (points: VisibilityProbePoints) => setProbePoints(points),
    [],
  )
  const recordMoveIntent = useCallback(
    (intent: MoveIntent) => setMoveIntents((current) => [...current, intent]),
    [],
  )
  const moveFixtureLight = useCallback(() => {
    setMovingLightCell((cell) =>
      cell.column === 101 ? { column: 106, row: 100 } : { column: 101, row: 100 },
    )
  }, [])
  const tokens = viewer === 'dm' ? FIXTURE_TOKENS : PLAYER_TOKENS
  const visibility = viewer === 'dm' ? DM_VISIBILITY : PLAYER_VISIBILITY
  const lights: readonly VisualLight[] = [
    ...FIXED_LIGHTS,
    {
      id: 'moving-torch',
      cell: movingLightCell,
      elevation: 3.5,
      color: '#ffd27a',
      intensity: 24,
      range: 18,
    },
  ]

  useEffect(() => {
    window.addEventListener('battle-map:move-light', moveFixtureLight)
    return () => window.removeEventListener('battle-map:move-light', moveFixtureLight)
  }, [moveFixtureLight])

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
        <BattleMapCamera
          onReady={markCameraReady}
          onVisibilityProbePoints={recordVisibilityProbePoints}
        />
        <BattleMapScene
          tokens={tokens}
          onMoveIntent={recordMoveIntent}
          visibility={visibility}
          lights={lights}
        />
      </Canvas>
      <ChunkDiagnostics cameraReady={cameraReady} />
      <TokenInteractionDiagnostics moveIntents={moveIntents} />
      <VisibilityDiagnostics
        viewer={viewer}
        tokens={tokens}
        visibility={visibility}
        movingLightCell={movingLightCell}
        probePoints={probePoints}
      />
    </div>
  )
}
