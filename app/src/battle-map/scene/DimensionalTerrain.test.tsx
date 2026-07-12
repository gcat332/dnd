import ReactThreeTestRenderer from '@react-three/test-renderer'
import type { Mesh, MeshStandardMaterial } from 'three'
import { expect, it } from 'vitest'
import type { TerrainFeature } from '../../battle-maps/terrain'
import { DimensionalTerrain } from './DimensionalTerrain'

const FEATURES: readonly TerrainFeature[] = [
  { id: 'w1', kind: 'wall', column: 90, row: 93, widthCells: 18, depthCells: 1, heightCells: 3 },
  { id: 'p1', kind: 'pillar', column: 100, row: 100, widthCells: 1, depthCells: 1, heightCells: 4 },
]

it('renders one mesh per terrain feature, positioned from its grid box', async () => {
  const renderer = await ReactThreeTestRenderer.create(<DimensionalTerrain features={FEATURES} />)

  const group = renderer.scene.findByProps({ name: 'dimensional-terrain' })
  expect(group.type).toBe('Group')

  const wall = renderer.scene.findByProps({ name: 'terrain-w1' })
  // wall box: center x = 90+18/2 = 99, y = 3/2 = 1.5, z = 93+1/2 = 93.5
  expect(wall.instance.position.toArray()).toEqual([99, 1.5, 93.5])
  expect(wall.instance.scale.toArray()).toEqual([18, 3, 1])

  const pillar = renderer.scene.findByProps({ name: 'terrain-p1' })
  expect(pillar.instance.position.toArray()).toEqual([100.5, 2, 100.5])

  await renderer.unmount()
})

it('renders an empty terrain group when given no features', async () => {
  const renderer = await ReactThreeTestRenderer.create(<DimensionalTerrain />)
  const group = renderer.scene.findByProps({ name: 'dimensional-terrain' })
  expect(group.children).toHaveLength(0)
  await renderer.unmount()
})

it('fades only requested terrain features without mutating normal materials', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <DimensionalTerrain features={FEATURES} fadedFeatureIds={new Set(['w1'])} />,
  )

  const wall = renderer.scene.findByProps({ name: 'terrain-w1' })
  const pillar = renderer.scene.findByProps({ name: 'terrain-p1' })
  const wallMaterial = (wall.instance as Mesh).material as MeshStandardMaterial
  const pillarMaterial = (pillar.instance as Mesh).material as MeshStandardMaterial
  expect(wallMaterial.opacity).toBe(0.2)
  expect(wallMaterial.transparent).toBe(true)
  expect(wallMaterial.depthWrite).toBe(false)
  expect(pillarMaterial.opacity).toBe(1)
  expect(pillarMaterial.transparent).toBe(false)
  expect(pillarMaterial.depthWrite).toBe(true)

  await renderer.unmount()
})
