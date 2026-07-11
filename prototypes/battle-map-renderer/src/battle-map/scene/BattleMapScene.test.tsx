import ReactThreeTestRenderer from '@react-three/test-renderer'
import { beforeEach, expect, it } from 'vitest'
import type { VisibilityGrid } from '../domain/visibility'
import { useBattleMapView } from '../state/useBattleMapView'
import { BattleMapScene } from './BattleMapScene'
import type { VisualLight } from './LightLayer'

const VISIBILITY: VisibilityGrid = {
  width: 200,
  height: 200,
  cells: Array.from({ length: 200 * 200 }, () => 'visible'),
}

const LIGHTS: readonly VisualLight[] = [
  {
    id: 'fixture',
    cell: { column: 100, row: 100 },
    elevation: 4,
    color: '#ffe0a0',
    intensity: 24,
    range: 14,
  },
]

beforeEach(() => {
  useBattleMapView.setState(useBattleMapView.getInitialState(), true)
})

it('builds overview map and visibility layers', async () => {
  const renderer = await ReactThreeTestRenderer.create(
    <BattleMapScene visibility={VISIBILITY} lights={LIGHTS} />,
  )
  expect(renderer.scene.findByProps({ name: 'ambient-map-light' }).type).toBe('AmbientLight')
  expect(renderer.scene.findByProps({ name: 'directional-map-light' }).type).toBe('DirectionalLight')
  expect(renderer.scene.findByProps({ name: 'light-layer' }).type).toBe('Group')
  expect(renderer.scene.findByProps({ name: 'visual-light-fixture' }).type).toBe('PointLight')
  expect(renderer.scene.findByProps({ name: 'overview-surface' }).type).toBe('Mesh')
  expect(renderer.scene.findByProps({ name: 'procedural-grid' }).type).toBe('Mesh')
  expect(renderer.scene.findByProps({ name: 'dimensional-terrain' }).type).toBe('Group')
  expect(renderer.scene.findByProps({ name: 'token-layer' }).type).toBe('Group')
  expect(renderer.scene.findByProps({ name: 'visibility-layer' }).type).toBe('Group')
  expect(renderer.scene.findByProps({ name: 'visibility-overview' }).type).toBe('Mesh')
  expect(renderer.scene.findAllByProps({ name: 'detail-chunk-surfaces' })).toHaveLength(0)
  await renderer.unmount()
})

it('builds matching detail map and visibility chunk layers', async () => {
  useBattleMapView.getState().setCamera({ x: 100, z: 100 }, 48)
  const renderer = await ReactThreeTestRenderer.create(
    <BattleMapScene visibility={VISIBILITY} lights={LIGHTS} />,
  )

  expect(renderer.scene.findByProps({ name: 'detail-chunk-surfaces' }).type).toBe('Group')
  expect(renderer.scene.findAllByProps({ name: 'visibility-overview' })).toHaveLength(0)
  const mapChunks = renderer.scene.findByProps({ name: 'detail-chunk-surfaces' }).children.length
  const visibilityChunks = renderer.scene
    .findByProps({ name: 'visibility-layer' })
    .children.filter((child) => child.props.name?.startsWith('visibility-chunk-')).length
  expect(visibilityChunks).toBe(mapChunks)
  await renderer.unmount()
})
