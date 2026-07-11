import ReactThreeTestRenderer from '@react-three/test-renderer'
import { expect, it, vi } from 'vitest'
import { DataTexture, NearestFilter, type Mesh, type ShaderMaterial } from 'three'
import type { CellVisibility, VisibilityGrid } from '../domain/visibility'
import { VisibilityLayer } from './VisibilityLayer'

function fixtureGrid(changes: ReadonlyArray<readonly [number, number, CellVisibility]> = []): VisibilityGrid {
  const cells: CellVisibility[] = Array.from({ length: 200 * 200 }, () => 'visible')
  for (const [column, row, visibility] of changes) cells[row * 200 + column] = visibility
  return { width: 200, height: 200, cells }
}

function textureFor(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>, name: string) {
  const mesh = renderer.scene.findByProps({ name })
  const material = (mesh.instance as Mesh).material as ShaderMaterial
  return { material, texture: material.uniforms.visibilityMap?.value as DataTexture }
}

it('maps texture rows from maximum to minimum world Z like the terrain textures', async () => {
  const grid = fixtureGrid([
    [96, 127, 'hidden'],
    [96, 126, 'explored'],
    [96, 96, 'visible'],
  ])
  const renderer = await ReactThreeTestRenderer.create(
    <VisibilityLayer mode="detail" grid={grid} visibleChunks={[{ column: 3, row: 3 }]} />,
  )
  const { texture } = textureFor(renderer, 'visibility-chunk-3:3')

  expect([...texture.image.data!.slice(0, 33)]).toEqual([
    0,
    ...Array.from({ length: 31 }, () => 255),
    96,
  ])
  expect(texture.image.data![31 * 32]).toBe(255)
  await renderer.unmount()
})

it('keeps adjacent world rows on the correct sides of adjacent Render Chunks', async () => {
  const grid = fixtureGrid([
    [96, 95, 'hidden'],
    [96, 64, 'explored'],
    [96, 127, 'explored'],
    [96, 96, 'hidden'],
  ])
  const renderer = await ReactThreeTestRenderer.create(
    <VisibilityLayer
      mode="detail"
      grid={grid}
      visibleChunks={[
        { column: 3, row: 2 },
        { column: 3, row: 3 },
      ]}
    />,
  )
  const north = textureFor(renderer, 'visibility-chunk-3:2').texture.image.data!
  const south = textureFor(renderer, 'visibility-chunk-3:3').texture.image.data!

  expect(north[0]).toBe(0)
  expect(north[31 * 32]).toBe(96)
  expect(south[0]).toBe(96)
  expect(south[31 * 32]).toBe(0)
  await renderer.unmount()
})

it('builds one nearest-filtered visibility texture per visible Render Chunk', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <VisibilityLayer
      mode="detail"
      grid={fixtureGrid()}
      visibleChunks={[{ column: 3, row: 3 }]}
    />,
  )
  const { material, texture } = textureFor(renderer, 'visibility-chunk-3:3')

  expect(texture).toBeInstanceOf(DataTexture)
  expect(texture.image.width).toBe(32)
  expect(texture.image.height).toBe(32)
  expect(texture.magFilter).toBe(NearestFilter)
  expect(texture.minFilter).toBe(NearestFilter)
  expect(material.fragmentShader).toContain('vec4(0.0, 0.0, 0.0, 1.0)')
  await renderer.unmount()
})

it('builds a clipped 8 by 8 texture for the map edge Render Chunk', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <VisibilityLayer
      mode="detail"
      grid={fixtureGrid()}
      visibleChunks={[{ column: 6, row: 6 }]}
    />,
  )
  const { texture } = textureFor(renderer, 'visibility-chunk-6:6')

  expect(texture.image.width).toBe(8)
  expect(texture.image.height).toBe(8)
  expect(texture.image.data).toHaveLength(64)
  await renderer.unmount()
})

it('renders one map-wide visibility texture in overview mode', async () => {
  const grid = fixtureGrid([
    [0, 199, 'hidden'],
    [0, 198, 'explored'],
  ])
  const renderer = await ReactThreeTestRenderer.create(
    <VisibilityLayer mode="overview" grid={grid} visibleChunks={[]} />,
  )
  const { texture } = textureFor(renderer, 'visibility-overview')

  expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1)
  expect(texture.image.width).toBe(200)
  expect(texture.image.height).toBe(200)
  expect(texture.image.data![0]).toBe(0)
  expect(texture.image.data![200]).toBe(96)
  expect(texture.image.data![199 * 200]).toBe(255)
  await renderer.unmount()
})

it('renders only the requested visibility chunks in detail mode', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <VisibilityLayer
      mode="detail"
      grid={fixtureGrid()}
      visibleChunks={[
        { column: 2, row: 3 },
        { column: 3, row: 3 },
      ]}
    />,
  )

  expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2)
  expect(renderer.scene.findAllByProps({ name: 'visibility-overview' })).toHaveLength(0)
  await renderer.unmount()
})

it('disposes visibility textures on grid replacement and unmount', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <VisibilityLayer
      mode="detail"
      grid={fixtureGrid()}
      visibleChunks={[{ column: 3, row: 3 }]}
    />,
  )
  const first = textureFor(renderer, 'visibility-chunk-3:3').texture
  const disposeFirst = vi.spyOn(first, 'dispose')

  await renderer.update(
    <VisibilityLayer
      mode="detail"
      grid={fixtureGrid([[96, 127, 'hidden']])}
      visibleChunks={[{ column: 3, row: 3 }]}
    />,
  )
  await vi.waitFor(() => expect(disposeFirst).toHaveBeenCalledOnce())
  const second = textureFor(renderer, 'visibility-chunk-3:3').texture
  const disposeSecond = vi.spyOn(second, 'dispose')

  await renderer.unmount()
  expect(disposeSecond).toHaveBeenCalledOnce()
})
