import ReactThreeTestRenderer from '@react-three/test-renderer'
import { expect, it, vi } from 'vitest'
import { Texture, type Mesh, type MeshStandardMaterial } from 'three'
import type { ChunkAddress } from '../domain/chunks'
import { MapSurface } from './MapSurface'

function textureMap(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>,
  address: ChunkAddress,
): Texture | null {
  const mesh = renderer.scene.findByProps({
    name: `chunk-surface-${address.column}:${address.row}`,
  }).instance as Mesh
  return (mesh.material as MeshStandardMaterial).map
}

it('retains overlapping chunk resources and disposes chunks that leave the selection', async () => {
  const textures = new Map<string, Texture>()
  const loadTexture = vi.fn(async (address: ChunkAddress) => {
    const texture = new Texture()
    textures.set(`${address.column}:${address.row}`, texture)
    return texture
  })
  const first = [{ column: 2, row: 3 }, { column: 3, row: 3 }] as const
  const second = [{ column: 3, row: 3 }, { column: 4, row: 3 }] as const
  const renderer = await ReactThreeTestRenderer.create(
    <MapSurface mode="detail" visibleChunks={first} loadTexture={loadTexture} />,
  )

  await vi.waitFor(() => expect(textureMap(renderer, first[1])).toBe(textures.get('3:3')))
  const departed = textures.get('2:3')!
  const shared = textures.get('3:3')!
  const departedDispose = vi.spyOn(departed, 'dispose')
  const sharedDispose = vi.spyOn(shared, 'dispose')

  await renderer.update(
    <MapSurface mode="detail" visibleChunks={second} loadTexture={loadTexture} />,
  )
  await vi.waitFor(() => expect(textureMap(renderer, second[1])).toBe(textures.get('4:3')))

  expect(textureMap(renderer, second[0])).toBe(shared)
  expect(loadTexture).toHaveBeenCalledTimes(3)
  expect(departedDispose).toHaveBeenCalledOnce()
  expect(sharedDispose).not.toHaveBeenCalled()
  await renderer.unmount()
})

it('loads exactly one visible stress chunk with a 2048px-class texture', async () => {
  const loadTexture = vi.fn(async (_address: ChunkAddress, textureSize: number) => {
    const texture = new Texture()
    texture.image = { width: textureSize, height: textureSize }
    return texture
  })
  const visibleChunks = [
    { column: 2, row: 3 },
    { column: 3, row: 3 },
    { column: 4, row: 3 },
  ] as const
  const renderer = await ReactThreeTestRenderer.create(
    <MapSurface
      mode="detail"
      visibleChunks={visibleChunks}
      maximumClassTextureCount={1}
      loadTexture={loadTexture}
    />,
  )

  await vi.waitFor(() => expect(loadTexture).toHaveBeenCalledTimes(3))
  expect(loadTexture.mock.calls.map(([, textureSize]) => textureSize)).toEqual([2048, 64, 64])
  await renderer.unmount()
})
