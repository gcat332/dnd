import ReactThreeTestRenderer from '@react-three/test-renderer'
import { expect, it, vi } from 'vitest'
import { Texture, type Mesh, type MeshStandardMaterial } from 'three'
import { ChunkSurface } from './ChunkSurface'

it('attaches the loaded fixture texture to one chunk material', async () => {
  const renderer = await ReactThreeTestRenderer.create(<ChunkSurface address={{ column: 2, row: 3 }} />)

  await vi.waitFor(() => {
    const mesh = renderer.scene.findByType('Mesh').instance as Mesh
    const material = mesh.material as MeshStandardMaterial
    expect(material.map).not.toBeNull()
    expect(material.version).toBeGreaterThan(0)
  })

  await renderer.unmount()
})

it('keeps one texture resource when the same chunk address is recreated', async () => {
  const renderer = await ReactThreeTestRenderer.create(<ChunkSurface address={{ column: 2, row: 3 }} />)
  let firstMap: MeshStandardMaterial['map'] = null

  await vi.waitFor(() => {
    const mesh = renderer.scene.findByType('Mesh').instance as Mesh
    firstMap = (mesh.material as MeshStandardMaterial).map
    expect(firstMap).not.toBeNull()
  })

  await renderer.update(<ChunkSurface address={{ column: 2, row: 3 }} />)
  await new Promise((resolve) => setTimeout(resolve, 0))

  const mesh = renderer.scene.findByType('Mesh').instance as Mesh
  expect((mesh.material as MeshStandardMaterial).map).toBe(firstMap)
  await renderer.unmount()
})

it('renders a handled fallback after all chunk load attempts fail', async () => {
  const loadTexture = vi.fn().mockRejectedValue(new Error('fixture unavailable'))
  const renderer = await ReactThreeTestRenderer.create(
    <ChunkSurface address={{ column: 2, row: 3 }} loadTexture={loadTexture} />,
  )

  await vi.waitFor(() => {
    const mesh = renderer.scene.findByType('Mesh').instance as Mesh
    expect(mesh.userData.loadState).toBe('failed')
  })

  const mesh = renderer.scene.findByType('Mesh').instance as Mesh
  expect((mesh.material as MeshStandardMaterial).map).toBeNull()
  expect(loadTexture).toHaveBeenCalledTimes(2)
  await renderer.unmount()
})

it('disposes a texture that finishes loading after unmount', async () => {
  let finishLoad: ((texture: Texture) => void) | undefined
  const loadTexture = vi.fn(
    () =>
      new Promise<Texture>((resolve) => {
        finishLoad = resolve
      }),
  )
  const texture = new Texture()
  const dispose = vi.spyOn(texture, 'dispose')
  const renderer = await ReactThreeTestRenderer.create(
    <ChunkSurface address={{ column: 2, row: 3 }} loadTexture={loadTexture} />,
  )

  await vi.waitFor(() => expect(loadTexture).toHaveBeenCalledOnce())
  await renderer.unmount()
  finishLoad?.(texture)

  await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce())
})

it('disposes the loaded texture when its chunk unmounts', async () => {
  const texture = new Texture()
  const dispose = vi.spyOn(texture, 'dispose')
  const renderer = await ReactThreeTestRenderer.create(
    <ChunkSurface
      address={{ column: 2, row: 3 }}
      loadTexture={vi.fn().mockResolvedValue(texture)}
    />,
  )

  await vi.waitFor(() => {
    const mesh = renderer.scene.findByType('Mesh').instance as Mesh
    expect((mesh.material as MeshStandardMaterial).map).toBe(texture)
  })
  await renderer.unmount()

  expect(dispose).toHaveBeenCalledOnce()
})
