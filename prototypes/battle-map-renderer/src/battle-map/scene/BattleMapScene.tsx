import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { ChunkAddress } from '../domain/chunks'
import type { AreaTemplate } from '../domain/effects'
import { MAP_SIZE_CELLS, type WorldPoint } from '../domain/grid'
import type { MoveIntent, TokenRenderState } from '../domain/tokens'
import type { VisibilityGrid } from '../domain/visibility'
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
}

const NO_TOKENS: readonly TokenRenderState[] = []
const NO_LIGHTS: readonly VisualLight[] = []
const ALL_VISIBLE: VisibilityGrid = {
  width: MAP_SIZE_CELLS,
  height: MAP_SIZE_CELLS,
  cells: Array.from({ length: MAP_SIZE_CELLS * MAP_SIZE_CELLS }, () => 'visible'),
}
const IGNORE_MOVE_INTENT = () => undefined

export function BattleMapScene({
  tokens = NO_TOKENS,
  onMoveIntent = IGNORE_MOVE_INTENT,
  visibility = ALL_VISIBLE,
  lights = NO_LIGHTS,
  targetTemplate = null,
  remoteTokenAnimations = [],
  onAnimatedTokenWorldPoint,
  onRemoteTokenAnimationComplete,
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
      />
      <LightLayer lights={lights} />
      <MapSurface mode={mode} visibleChunks={visibleChunks} />
      <ProceduralGrid />
      <DimensionalTerrain />
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
