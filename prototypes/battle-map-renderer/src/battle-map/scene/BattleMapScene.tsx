import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import type { ChunkAddress } from '../domain/chunks'
import type { AreaTemplate } from '../domain/effects'
import { MAP_SIZE_CELLS, type WorldPoint } from '../domain/grid'
import type { MoveIntent, TokenRenderState } from '../domain/tokens'
import type { VisibilityGrid } from '../domain/visibility'
import type { StressWall } from '../fixtures/createStressScene'
import type { SceneQualitySettings } from '../performance/quality'
import {
  mapDetailMode,
  visibleChunkAddresses,
  type MapDetailMode,
  type WorldBounds,
} from '../domain/viewport'
import { useBattleMapView } from '../state/useBattleMapView'
import type { RemoteTokenAnimation } from './AnimatedToken'
import { DimensionalTerrain } from './DimensionalTerrain'
import { LightLayer, type VisualLight } from './LightLayer'
import { chunkAddressKey, MapSurface } from './MapSurface'
import { ProceduralGrid } from './ProceduralGrid'
import { TokenLayer } from './TokenLayer'
import { TargetingLayer } from './TargetingLayer'
import { VisibilityLayer } from './VisibilityLayer'

const CELL_TEXTURE_PIXELS = 64

export type SceneSelection = Readonly<{
  mode: MapDetailMode
  visibleChunks: readonly ChunkAddress[]
}>

export function sceneSelection(cameraCenter: { x: number; z: number }, visibleCellSpan: number): SceneSelection {
  const halfSpan = visibleCellSpan / 2
  const bounds: WorldBounds = {
    minX: Math.max(0, cameraCenter.x - halfSpan),
    minZ: Math.max(0, cameraCenter.z - halfSpan),
    maxX: Math.min(MAP_SIZE_CELLS, cameraCenter.x + halfSpan),
    maxZ: Math.min(MAP_SIZE_CELLS, cameraCenter.z + halfSpan),
  }
  const mode = mapDetailMode(visibleCellSpan)
  return {
    mode,
    visibleChunks: mode === 'detail' ? visibleChunkAddresses(bounds, CELL_TEXTURE_PIXELS) : [],
  }
}

export function useSceneSelection(): SceneSelection {
  const cameraCenter = useBattleMapView((state) => state.cameraCenter)
  const visibleCellSpan = useBattleMapView((state) => state.visibleCellSpan)
  return useMemo(
    () => sceneSelection(cameraCenter, visibleCellSpan),
    [cameraCenter, visibleCellSpan],
  )
}

type BattleMapSceneProps = {
  tokens?: readonly TokenRenderState[]
  onMoveIntent?: (intent: MoveIntent) => void
  visibility?: VisibilityGrid
  lights?: readonly VisualLight[]
  targetTemplate?: AreaTemplate | null
  remoteTokenAnimations?: readonly RemoteTokenAnimation[]
  onAnimatedTokenWorldPoint?: (tokenId: string, point: WorldPoint) => void
  onRemoteTokenAnimationComplete?: (animation: RemoteTokenAnimation) => void
  qualitySettings?: SceneQualitySettings
  stressWalls?: readonly StressWall[]
  stressEffects?: boolean
}

const NO_TOKENS: readonly TokenRenderState[] = []
const NO_LIGHTS: readonly VisualLight[] = []
const ALL_VISIBLE: VisibilityGrid = {
  width: MAP_SIZE_CELLS,
  height: MAP_SIZE_CELLS,
  cells: Array.from({ length: MAP_SIZE_CELLS * MAP_SIZE_CELLS }, () => 'visible'),
}
const IGNORE_MOVE_INTENT = () => undefined
const DEFAULT_QUALITY: SceneQualitySettings = {
  maxDpr: 2,
  shadowMapSize: 2048,
  softShadows: true,
  particleScale: 1,
  postProcessing: true,
}

function StressEffect({ particleScale }: Readonly<{ particleScale: number }>) {
  const group = useRef<Group>(null)
  const particleCount = Math.round(48 * particleScale)
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.elapsedTime * 0.35
  })
  return (
    <group ref={group} name="stress-particle-effect" position={[100, 0, 100]}>
      {Array.from({ length: particleCount }, (_, index) => (
        <mesh
          key={index}
          position={[-6 + (index % 12), 0.35 + (index % 4) * 0.16, -4 + Math.floor(index / 12)]}
        >
          <sphereGeometry args={[0.09, 4, 4]} />
          <meshBasicMaterial color={index % 2 === 0 ? '#ffcf66' : '#6bdcff'} />
        </mesh>
      ))}
    </group>
  )
}

export function BattleMapScene({
  tokens = NO_TOKENS,
  onMoveIntent = IGNORE_MOVE_INTENT,
  visibility = ALL_VISIBLE,
  lights = NO_LIGHTS,
  targetTemplate = null,
  remoteTokenAnimations = [],
  onAnimatedTokenWorldPoint,
  onRemoteTokenAnimationComplete,
  qualitySettings = DEFAULT_QUALITY,
  stressWalls = [],
  stressEffects = false,
}: BattleMapSceneProps = {}) {
  const invalidate = useThree((state) => state.invalidate)
  const { mode, visibleChunks } = useSceneSelection()
  const visibleChunkKeys = visibleChunks.map(chunkAddressKey).join(',')

  useEffect(() => {
    invalidate()
  }, [invalidate, mode, visibleChunkKeys])

  return (
    <>
      <ambientLight name="ambient-map-light" intensity={1.25} />
      <directionalLight
        name="directional-map-light"
        position={[78, 130, 52]}
        intensity={2.15}
        castShadow
        shadow-mapSize-width={qualitySettings.shadowMapSize}
        shadow-mapSize-height={qualitySettings.shadowMapSize}
      />
      <LightLayer lights={lights} shadowMapSize={qualitySettings.shadowMapSize} />
      <MapSurface mode={mode} visibleChunks={visibleChunks} />
      <ProceduralGrid />
      <DimensionalTerrain stressWalls={stressWalls} />
      {stressEffects ? <StressEffect particleScale={qualitySettings.particleScale} /> : null}
      <TargetingLayer template={targetTemplate} />
      <TokenLayer
        tokens={tokens}
        onMoveIntent={onMoveIntent}
        remoteTokenAnimations={remoteTokenAnimations}
        onAnimatedTokenWorldPoint={onAnimatedTokenWorldPoint}
        onRemoteTokenAnimationComplete={onRemoteTokenAnimationComplete}
      />
      <VisibilityLayer mode={mode} grid={visibility} visibleChunks={visibleChunks} />
    </>
  )
}
