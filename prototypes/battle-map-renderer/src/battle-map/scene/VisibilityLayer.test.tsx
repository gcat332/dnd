import ReactThreeTestRenderer from '@react-three/test-renderer'
import { expect, it } from 'vitest'
import { DataTexture, NearestFilter, type Mesh, type ShaderMaterial } from 'three'
import type { CellVisibility, VisibilityGrid } from '../domain/visibility'
import { VisibilityLayer } from './VisibilityLayer'

function fixtureGrid(): VisibilityGrid {
  const cells: CellVisibility[] = Array.from({ length: 200 * 200 }, () => 'visible')
  cells[96 * 200 + 96] = 'hidden'
  cells[96 * 200 + 97] = 'explored'
  return { width: 200, height: 200, cells }
}

it('builds one nearest-filtered visibility texture per visible Render Chunk', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <VisibilityLayer grid={fixtureGrid()} visibleChunks={[{ column: 3, row: 3 }]} />,
  )

  const mesh = renderer.scene.findByProps({ name: 'visibility-chunk-3:3' })
  const material = (mesh.instance as Mesh).material as ShaderMaterial
  const texture = material.uniforms.visibilityMap?.value as DataTexture

  expect(texture).toBeInstanceOf(DataTexture)
  expect(texture.image.width).toBe(32)
  expect(texture.image.height).toBe(32)
  expect([...texture.image.data!.slice(0, 3)]).toEqual([0, 96, 255])
  expect(texture.magFilter).toBe(NearestFilter)
  expect(texture.minFilter).toBe(NearestFilter)
  expect(material.fragmentShader).toContain('vec4(0.0, 0.0, 0.0, 1.0)')
  await renderer.unmount()
})

it('renders only the requested visible Render Chunks', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <VisibilityLayer
      grid={fixtureGrid()}
      visibleChunks={[
        { column: 2, row: 3 },
        { column: 3, row: 3 },
      ]}
    />,
  )

  expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2)
  await renderer.unmount()
})
