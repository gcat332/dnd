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
  type MaximumClassTextureRender,
} from './ChunkSurface'

const OVERVIEW_PLANE = new PlaneGeometry(1, 1)
const OVERVIEW_TEXTURE = createOverviewTexture()

export function chunkAddressKey(address: ChunkAddress): string {
  return `${address.column}:${address.row}`
}

type MapSurfaceProps = {
  mode: MapDetailMode
  visibleChunks: readonly ChunkAddress[]
  maximumClassTextureAddress?: ChunkAddress | null
  loadTexture?: ChunkTextureLoader
  onMaximumClassTextureRender?: (diagnostic: MaximumClassTextureRender) => void
}

export function MapSurface({
  mode,
  visibleChunks,
  maximumClassTextureAddress = null,
  loadTexture,
  onMaximumClassTextureRender,
}: MapSurfaceProps) {
  if (mode === 'detail') {
    return (
      <group name="detail-chunk-surfaces">
        {visibleChunks.map((address) => (
          <ChunkSurface
            key={chunkAddressKey(address)}
            address={address}
            textureSize={
              maximumClassTextureAddress?.column === address.column &&
              maximumClassTextureAddress.row === address.row
                ? MAX_CHUNK_TEXTURE_PIXELS
                : STANDARD_DETAIL_TEXTURE_SIZE
            }
            loadTexture={loadTexture}
            onMaximumClassTextureRender={onMaximumClassTextureRender}
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
