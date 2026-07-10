import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { ChunkAddress } from '../domain/chunks'
import { MAP_SIZE_CELLS } from '../domain/grid'
import type { MoveIntent, TokenRenderState } from '../domain/tokens'
import {
  mapDetailMode,
  visibleChunkAddresses,
  type MapDetailMode,
  type WorldBounds,
} from '../domain/viewport'
import { useBattleMapView } from '../state/useBattleMapView'
import { DimensionalTerrain } from './DimensionalTerrain'
import { chunkAddressKey, MapSurface } from './MapSurface'
import { ProceduralGrid } from './ProceduralGrid'
import { TokenLayer } from './TokenLayer'

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
}

const NO_TOKENS: readonly TokenRenderState[] = []
const IGNORE_MOVE_INTENT = () => undefined

export function BattleMapScene({
  tokens = NO_TOKENS,
  onMoveIntent = IGNORE_MOVE_INTENT,
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
      <MapSurface mode={mode} visibleChunks={visibleChunks} />
      <ProceduralGrid />
      <DimensionalTerrain />
      <TokenLayer tokens={tokens} onMoveIntent={onMoveIntent} />
    </>
  )
}
