import ReactThreeTestRenderer from '@react-three/test-renderer'
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
