import { describe, expect, it } from 'vitest'
import type { DataTexture } from 'three'
import { createChunkTexture, createOverviewTexture, terrainColor } from './createChunkTexture'

type TextureImage = {
  data: Uint8Array
  width: number
  height: number
}

type TextureBounds = {
  minX: number
  minZ: number
  maxX: number
  maxZ: number
}

function imageOf(texture: DataTexture): TextureImage {
  return texture.image as TextureImage
}

function fixtureColor(worldX: number, worldZ: number): readonly number[] {
  return [...new Uint8Array(terrainColor(worldX, worldZ))]
}

function rgbAt(texture: DataTexture, x: number, y: number): readonly number[] {
  const image = imageOf(texture)
  const index = (y * image.width + x) * 4
  return [...image.data.slice(index, index + 3)]
}

function displayedWorldSample(
  texture: DataTexture,
  bounds: TextureBounds,
  worldX: number,
  worldZ: number,
): { x: number; z: number; rgb: readonly number[] } {
  const image = imageOf(texture)
  const width = bounds.maxX - bounds.minX
  const depth = bounds.maxZ - bounds.minZ
  const pixelX = Math.floor(((worldX - bounds.minX) / width) * image.width)
  const pixelY = Math.floor(((bounds.maxZ - worldZ) / depth) * image.height)
  return {
    x: bounds.minX + ((pixelX + 0.5) / image.width) * width,
    z: bounds.maxZ - ((pixelY + 0.5) / image.height) * depth,
    rgb: rgbAt(texture, pixelX, pixelY),
  }
}

describe('chunk fixture texture coordinates', () => {
  it('uses distinct visual colors for road, water, forest, and grass', () => {
    const road = terrainColor(100, 92 + Math.sin(100 * 0.045) * 8)
    const water = terrainColor(151 + Math.sin(100 * 0.055) * 9, 100)
    const forest = terrainColor(0, 0)
    const grass = terrainColor(12, 0)

    expect(road[0]).toBeGreaterThan(road[2])
    expect(water[2]).toBeGreaterThan(water[0])
    expect(forest[1]).toBeLessThan(grass[1])
    expect(grass[1]).toBeGreaterThan(grass[0])
  })

  it('creates a maximum-class detail texture when explicitly requested', () => {
    const texture = createChunkTexture({ column: 2, row: 3 }, 2048)

    expect(imageOf(texture)).toMatchObject({ width: 2048, height: 2048 })
    expect(imageOf(texture).data.byteLength).toBe(2048 * 2048 * 4)
  })

  it('orients adjacent chunk rows from maximum to minimum world Z', () => {
    const north = createChunkTexture({ column: 2, row: 0 })
    const south = createChunkTexture({ column: 2, row: 1 })
    const x = 64 + (10.5 / 64) * 32

    expect(rgbAt(north, 10, 0)).toEqual(fixtureColor(x, 31.75))
    expect(rgbAt(north, 10, 63)).toEqual(fixtureColor(x, 0.25))
    expect(rgbAt(south, 10, 63)).toEqual(fixtureColor(x, 32.25))
  })

  it('samples clipped edge chunks only inside world 192 through 200', () => {
    const edge = createChunkTexture({ column: 6, row: 6 })
    const nearMaximum = 192 + (63.5 / 64) * 8
    const nearMinimum = 192 + (0.5 / 64) * 8

    expect(rgbAt(edge, 63, 0)).toEqual(fixtureColor(nearMaximum, nearMaximum))
    expect(rgbAt(edge, 0, 63)).toEqual(fixtureColor(nearMinimum, nearMinimum))
    expect(rgbAt(edge, 63, 0)).not.toEqual(fixtureColor(223.75, 192.25))
  })

  it.each([
    {
      name: 'road',
      worldX: 100,
      worldZ: 92 + Math.sin(100 * 0.045) * 8,
      detailAddress: { column: 3, row: 2 },
      detailBounds: { minX: 96, minZ: 64, maxX: 128, maxZ: 96 },
    },
    {
      name: 'water',
      worldX: 151 + Math.sin(100 * 0.055) * 9,
      worldZ: 100,
      detailAddress: { column: 4, row: 3 },
      detailBounds: { minX: 128, minZ: 96, maxX: 160, maxZ: 128 },
    },
  ])('keeps the $name sample at one world position in overview and detail', (feature) => {
    const overview = displayedWorldSample(
      createOverviewTexture(),
      { minX: 0, minZ: 0, maxX: 200, maxZ: 200 },
      feature.worldX,
      feature.worldZ,
    )
    const detail = displayedWorldSample(
      createChunkTexture(feature.detailAddress),
      feature.detailBounds,
      feature.worldX,
      feature.worldZ,
    )

    expect(overview.rgb).toEqual(fixtureColor(overview.x, overview.z))
    expect(detail.rgb).toEqual(fixtureColor(detail.x, detail.z))
  })
})
