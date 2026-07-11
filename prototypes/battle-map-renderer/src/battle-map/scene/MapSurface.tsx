import { PlaneGeometry } from 'three'
import { createOverviewTexture } from '../fixtures/createChunkTexture'
import { MAP_SIZE_CELLS } from '../domain/grid'
import type { ChunkAddress } from '../domain/chunks'
import type { MapDetailMode } from '../domain/viewport'
import { MAX_CHUNK_TEXTURE_PIXELS } from '../domain/chunks'
import {
  ChunkSurface,
  STANDARD_DETAIL_TEXTURE_SIZE,
  type ChunkTextureLoader,
} from './ChunkSurface'

const OVERVIEW_PLANE = new PlaneGeometry(1, 1)
const OVERVIEW_TEXTURE = createOverviewTexture()

export function chunkAddressKey(address: ChunkAddress): string {
  return `${address.column}:${address.row}`
}

type MapSurfaceProps = {
  mode: MapDetailMode
  visibleChunks: readonly ChunkAddress[]
  maximumClassTextureCount?: number
  loadTexture?: ChunkTextureLoader
}

export function MapSurface({
  mode,
  visibleChunks,
  maximumClassTextureCount = 0,
  loadTexture,
}: MapSurfaceProps) {
  if (mode === 'detail') {
    return (
      <group name="detail-chunk-surfaces">
        {visibleChunks.map((address, index) => (
          <ChunkSurface
            key={chunkAddressKey(address)}
            address={address}
            textureSize={
              index < maximumClassTextureCount
                ? MAX_CHUNK_TEXTURE_PIXELS
                : STANDARD_DETAIL_TEXTURE_SIZE
            }
            loadTexture={loadTexture}
          />
        ))}
      </group>
    )
  }

  return (
    <mesh
      name="overview-surface"
      position={[MAP_SIZE_CELLS / 2, 0, MAP_SIZE_CELLS / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[MAP_SIZE_CELLS, MAP_SIZE_CELLS, 1]}
      receiveShadow
    >
      <primitive object={OVERVIEW_PLANE} attach="geometry" />
      <meshStandardMaterial map={OVERVIEW_TEXTURE} roughness={0.96} metalness={0} />
    </mesh>
  )
}
