import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'
import { chunkBounds, type ChunkAddress } from '../domain/chunks'
import { MAP_SIZE_CELLS } from '../domain/grid'

const CHUNK_TEXTURE_SIZE = 64
const OVERVIEW_TEXTURE_SIZE = 128
const CELL_TEXTURE_PIXELS = 64

function terrainColor(worldX: number, worldZ: number): readonly [number, number, number] {
  const variation = Math.sin(worldX * 0.17) * 7 + Math.cos(worldZ * 0.13) * 6
  const roadDistance = Math.abs(worldZ - (92 + Math.sin(worldX * 0.045) * 8))
  const waterDistance = Math.abs(worldX - (151 + Math.sin(worldZ * 0.055) * 9))

  if (roadDistance < 3.2) return [126 + variation, 111 + variation, 78 + variation]
  if (waterDistance < 5.5) return [48 + variation, 103 + variation, 116 + variation]
  if ((Math.floor(worldX / 12) + Math.floor(worldZ / 12)) % 7 === 0) {
    return [82 + variation, 111 + variation, 69 + variation]
  }
  return [68 + variation, 93 + variation, 60 + variation]
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

export function createChunkTexture(address: ChunkAddress): DataTexture {
  const bounds = chunkBounds(address, CELL_TEXTURE_PIXELS)
  const width = bounds.maxColumnExclusive - bounds.minColumn
  const depth = bounds.maxRowExclusive - bounds.minRow
  return createTexture(CHUNK_TEXTURE_SIZE, (x, y) => [
    bounds.minColumn + ((x + 0.5) / CHUNK_TEXTURE_SIZE) * width,
    bounds.maxRowExclusive - ((y + 0.5) / CHUNK_TEXTURE_SIZE) * depth,
  ])
}

export function createOverviewTexture(): DataTexture {
  return createTexture(OVERVIEW_TEXTURE_SIZE, (x, y) => [
    ((x + 0.5) / OVERVIEW_TEXTURE_SIZE) * MAP_SIZE_CELLS,
    MAP_SIZE_CELLS - ((y + 0.5) / OVERVIEW_TEXTURE_SIZE) * MAP_SIZE_CELLS,
  ])
}
