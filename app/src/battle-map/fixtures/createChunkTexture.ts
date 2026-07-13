import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'
import { MAX_CHUNK_TEXTURE_PIXELS, chunkBounds, type ChunkAddress } from '../domain/chunks'
import { MAP_SIZE_CELLS } from '../domain/grid'

const CHUNK_TEXTURE_SIZE = 64
const OVERVIEW_TEXTURE_SIZE = 128
const CELL_TEXTURE_PIXELS = 64

export type TerrainBiome = 'grass' | 'forest' | 'water' | 'road'

export function terrainBiomeAt(worldX: number, worldZ: number): TerrainBiome {
  const roadDistance = Math.abs(worldZ - (92 + Math.sin(worldX * 0.045) * 8))
  const waterDistance = Math.abs(worldX - (151 + Math.sin(worldZ * 0.055) * 9))

  if (roadDistance < 3.2) return 'road'
  if (waterDistance < 5.5) return 'water'
  if ((Math.floor(worldX / 12) + Math.floor(worldZ / 12)) % 7 === 0) return 'forest'
  return 'grass'
}

export function terrainColor(worldX: number, worldZ: number): readonly [number, number, number] {
  const variation = Math.sin(worldX * 0.17) * 7 + Math.cos(worldZ * 0.13) * 6
  const biome = terrainBiomeAt(worldX, worldZ)

  if (biome === 'road') return [158 + variation, 126 + variation, 76 + variation]
  if (biome === 'water') return [42 + variation, 126 + variation, 176 + variation]
  if (biome === 'forest') return [42 + variation, 86 + variation, 48 + variation]
  return [112 + variation, 150 + variation, 78 + variation]
}

function createTexture(
  size: number,
  worldPointForPixel: (x: number, y: number) => readonly [number, number],
): DataTexture {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [worldX, worldZ] = worldPointForPixel(x, y)
      const [red, green, blue] = terrainColor(worldX, worldZ)
      const index = (y * size + x) * 4
      data[index] = red
      data[index + 1] = green
      data[index + 2] = blue
      data[index + 3] = 255
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

export function createChunkTexture(
  address: ChunkAddress,
  textureSize = CHUNK_TEXTURE_SIZE,
): DataTexture {
  if (!Number.isInteger(textureSize) || textureSize <= 0 || textureSize > MAX_CHUNK_TEXTURE_PIXELS) {
    throw new RangeError('Chunk texture size must be an integer from 1 through 2048 pixels')
  }
  const bounds = chunkBounds(address, CELL_TEXTURE_PIXELS)
  const width = bounds.maxColumnExclusive - bounds.minColumn
  const depth = bounds.maxRowExclusive - bounds.minRow
  return createTexture(textureSize, (x, y) => [
    bounds.minColumn + ((x + 0.5) / textureSize) * width,
    bounds.maxRowExclusive - ((y + 0.5) / textureSize) * depth,
  ])
}

export function createOverviewTexture(): DataTexture {
  return createTexture(OVERVIEW_TEXTURE_SIZE, (x, y) => [
    ((x + 0.5) / OVERVIEW_TEXTURE_SIZE) * MAP_SIZE_CELLS,
    MAP_SIZE_CELLS - ((y + 0.5) / OVERVIEW_TEXTURE_SIZE) * MAP_SIZE_CELLS,
  ])
}
