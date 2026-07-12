import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import type { TerrainFeature } from '../../battle-maps/terrain'
import { occludingTerrainFeatureIds } from '../camera/occlusion'
import { chunkAddressForCell, type ChunkAddress } from '../domain/chunks'
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
import type { MaximumClassTextureRender } from './ChunkSurface'

const CELL_TEXTURE_PIXELS = 64

export type SceneSelection = Readonly<{
  mode: MapDetailMode
  visibleChunks: readonly ChunkAddress[]
  centerChunk: ChunkAddress | null
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
  const centerCell = {
    column: Math.min(MAP_SIZE_CELLS - 1, Math.max(0, Math.floor(cameraCenter.x))),
    row: Math.min(MAP_SIZE_CELLS - 1, Math.max(0, Math.floor(cameraCenter.z))),
  }
  return {
    mode,
    visibleChunks: mode === 'detail' ? visibleChunkAddresses(bounds, CELL_TEXTURE_PIXELS) : [],
    centerChunk:
      mode === 'detail' ? chunkAddressForCell(centerCell, CELL_TEXTURE_PIXELS) : null,
  }
}

export function useSceneSelection(): SceneSelection {
  const cameraFocus = useBattleMapView((state) => state.cameraView.focus)
  const visibleCellSpan = useBattleMapView((state) => state.visibleCellSpan)
  return useMemo(
    () => sceneSelection(cameraFocus, visibleCellSpan),
    [cameraFocus, visibleCellSpan],
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
  terrainFeatures?: readonly TerrainFeature[]
  stressWalls?: readonly StressWall[]
  stressEffects?: boolean
  onMaximumClassTextureRender?: (diagnostic: MaximumClassTextureRender) => void
}

const NO_TOKENS: readonly TokenRenderState[] = []
const NO_LIGHTS: readonly VisualLight[] = []
const NO_TERRAIN: readonly TerrainFeature[] = []
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
  outputProcessing: true,
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
  terrainFeatures = NO_TERRAIN,
  stressWalls = [],
  stressEffects = false,
  onMaximumClassTextureRender,
}: BattleMapSceneProps = {}) {
  const invalidate = useThree((state) => state.invalidate)
  const { mode, visibleChunks, centerChunk } = useSceneSelection()
  const visibleChunkKeys = visibleChunks.map(chunkAddressKey).join(',')
  const selectedTokenId = useBattleMapView((state) => state.selectedTokenId)
  const cameraView = useBattleMapView((state) => state.cameraView)
  const selectedVisibleToken = useMemo(
    () => tokens.filter((token) => token.visible).find((token) => token.id === selectedTokenId),
    [selectedTokenId, tokens],
  )
  const fadedFeatureIds = useMemo(
    () => occludingTerrainFeatureIds(terrainFeatures, selectedVisibleToken, cameraView),
    [cameraView, selectedVisibleToken, terrainFeatures],
  )
  const fadedFeatureKey = [...fadedFeatureIds].join(',')

  useEffect(() => {
    invalidate()
  }, [fadedFeatureKey, invalidate, mode, visibleChunkKeys])

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
      <MapSurface
        mode={mode}
        visibleChunks={visibleChunks}
        maximumClassTextureAddress={stressEffects ? centerChunk : null}
        onMaximumClassTextureRender={onMaximumClassTextureRender}
      />
      <ProceduralGrid />
      <DimensionalTerrain
        features={terrainFeatures}
        stressWalls={stressWalls}
        fadedFeatureIds={fadedFeatureIds}
      />
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
