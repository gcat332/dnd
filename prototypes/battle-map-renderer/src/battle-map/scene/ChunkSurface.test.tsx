import ReactThreeTestRenderer from '@react-three/test-renderer'
import { expect, it, vi } from 'vitest'
import type { Mesh, MeshStandardMaterial } from 'three'
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
